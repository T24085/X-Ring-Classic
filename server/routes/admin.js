const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireRole } = require('../middleware/auth');
const firebaseService = require('../services/firebase');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireRole(['admin']));

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Private (Admin only)
router.get('/dashboard', async (req, res) => {
  try {
    // Accept optional period param via query, even if not used yet
    const { period } = req.query;
    const stats = await firebaseService.getSystemStats(period);

    // Expose recentActivity at the top level for client convenience
    res.json({
      stats,
      recentActivity: stats?.recentActivity || [],
      message: 'Dashboard statistics retrieved successfully'
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to get dashboard statistics' });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users with pagination and filters
// @access  Private (Admin only)
router.get('/users', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      role,
      isVerified,
      isActive,
      search
    } = req.query;

    let users = await firebaseService.find('users', {});

    // Apply filters
    if (role) {
      users = users.filter(user => user.role === role);
    }
    if (isVerified !== undefined) {
      users = users.filter(user => user.isVerified === (isVerified === 'true'));
    }
    if (isActive !== undefined) {
      users = users.filter(user => user.isActive === (isActive === 'true'));
    }
    if (search) {
      users = users.filter(user =>
        user.username?.toLowerCase().includes(search.toLowerCase()) ||
        user.firstName?.toLowerCase().includes(search.toLowerCase()) ||
        user.lastName?.toLowerCase().includes(search.toLowerCase()) ||
        user.email?.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Apply pagination
    const skip = (page - 1) * limit;
    const paginatedUsers = users.slice(skip, skip + parseInt(limit));

    // Remove passwords from response
    const safeUsers = paginatedUsers.map(user => {
      const { password, ...safeUser } = user;
      return safeUser;
    });

    res.json({
      users: safeUsers,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(users.length / limit),
        hasNext: page * limit < users.length,
        hasPrev: page > 1,
        totalUsers: users.length
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// @route   GET /api/admin/competitions
// @desc    Get all competitions with pagination and filters
// @access  Private (Admin only)
router.get('/competitions', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      competitionType,
      format,
      search
    } = req.query;

    let competitions = await firebaseService.find('competitions', {});

    // Apply filters
    if (status) {
      competitions = competitions.filter(comp => comp.status === status);
    }
    if (competitionType) {
      competitions = competitions.filter(comp => comp.competitionType === competitionType);
    }
    if (format) {
      competitions = competitions.filter(comp => comp.format === format);
    }
    if (search) {
      competitions = competitions.filter(comp =>
        comp.title?.toLowerCase().includes(search.toLowerCase()) ||
        comp.description?.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Apply pagination
    const skip = (page - 1) * limit;
    const paginatedCompetitions = competitions.slice(skip, skip + parseInt(limit));

    // Populate organizer information
    const competitionsWithOrganizers = await Promise.all(
      paginatedCompetitions.map(async (comp) => {
        if (comp.organizerId) {
          const organizer = await firebaseService.getById('users', comp.organizerId);
          return {
            ...comp,
            organizer: organizer ? {
              id: organizer.id,
              username: organizer.username,
              firstName: organizer.firstName,
              lastName: organizer.lastName
            } : null
          };
        }
        return comp;
      })
    );

    res.json({
      competitions: competitionsWithOrganizers,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(competitions.length / limit),
        hasNext: page * limit < competitions.length,
        hasPrev: page > 1,
        totalCompetitions: competitions.length
      }
    });
  } catch (error) {
    console.error('Get competitions error:', error);
    res.status(500).json({ error: 'Failed to get competitions' });
  }
});

// @route   GET /api/admin/scores
// @desc    Get all scores with pagination and filters
// @access  Private (Admin only)
router.get('/scores', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      verificationStatus,
      competitionId,
      search
    } = req.query;

    let scores = await firebaseService.find('scores', {});

    // Apply filters
    if (verificationStatus) {
      scores = scores.filter(score => score.verificationStatus === verificationStatus);
    }
    if (competitionId) {
      scores = scores.filter(score => score.competitionId === competitionId);
    }

    // Apply pagination
    const skip = (page - 1) * limit;
    const paginatedScores = scores.slice(skip, skip + parseInt(limit));

    // Populate competitor and competition information
    const scoresWithDetails = await Promise.all(
      paginatedScores.map(async (score) => {
        const [competitor, competition] = await Promise.all([
          firebaseService.getById('users', score.competitorId),
          firebaseService.getById('competitions', score.competitionId)
        ]);

        return {
          ...score,
          competitor: competitor ? {
            id: competitor.id,
            username: competitor.username,
            firstName: competitor.firstName,
            lastName: competitor.lastName
          } : null,
          competition: competition ? {
            id: competition.id,
            title: competition.title,
            competitionType: competition.competitionType
          } : null
        };
      })
    );

    res.json({
      scores: scoresWithDetails,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(scores.length / limit),
        hasNext: page * limit < scores.length,
        hasPrev: page > 1,
        totalScores: scores.length
      }
    });
  } catch (error) {
    console.error('Get scores error:', error);
    res.status(500).json({ error: 'Failed to get scores' });
  }
});

// @route   PUT /api/admin/users/:userId/role
// @desc    Update user role
// @access  Private (Admin only)
router.put('/users/:userId/role', [
  body('role')
    .isIn(['competitor', 'range_officer', 'admin'])
    .withMessage('Role must be competitor, range_officer, or admin')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { role } = req.body;

    const user = await firebaseService.getById('users', req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await firebaseService.update('users', req.params.userId, { role });

    res.json({ message: 'User role updated successfully' });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// @route   PUT /api/admin/competitions/:competitionId/status
// @desc    Update competition status
// @access  Private (Admin only)
router.put('/competitions/:competitionId/status', [
  body('status')
    .isIn(['draft', 'published', 'completed', 'cancelled'])
    .withMessage('Status must be draft, published, completed, or cancelled')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status } = req.body;

    const competition = await firebaseService.getById('competitions', req.params.competitionId);
    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    await firebaseService.update('competitions', req.params.competitionId, { status });

    res.json({ message: 'Competition status updated successfully' });
  } catch (error) {
    console.error('Update competition status error:', error);
    res.status(500).json({ error: 'Failed to update competition status' });
  }
});

// @route   DELETE /api/admin/scores/:scoreId
// @desc    Delete a score
// @access  Private (Admin only)
router.delete('/scores/:scoreId', async (req, res) => {
  try {
    const score = await firebaseService.getById('scores', req.params.scoreId);
    if (!score) {
      return res.status(404).json({ error: 'Score not found' });
    }

    await firebaseService.delete('scores', req.params.scoreId);

    res.json({ message: 'Score deleted successfully' });
  } catch (error) {
    console.error('Delete score error:', error);
    res.status(500).json({ error: 'Failed to delete score' });
  }
});

// @route   GET /api/admin/reports
// @desc    Get system reports and analytics
// @access  Private (Admin only)
router.get('/reports', async (req, res) => {
  try {
    const { type = 'overview', timeRange = '30days' } = req.query;

    // Get basic stats
    const stats = await firebaseService.getSystemStats();

    // Get recent activity
    const recentScores = await firebaseService.find('scores', { 
      limit: 10,
      orderBy: 'createdAt',
      orderDirection: 'desc'
    });

    const recentCompetitions = await firebaseService.find('competitions', {
      limit: 5,
      orderBy: 'createdAt',
      orderDirection: 'desc'
    });

    // Get pending verifications
    const pendingScores = await firebaseService.getPendingVerificationScores();

    // Get unverified users
    const unverifiedUsers = await firebaseService.getUnverifiedUsers();

    const reports = {
      overview: {
        totalUsers: stats.totalUsers,
        totalCompetitions: stats.totalCompetitions,
        totalScores: stats.totalScores,
        unverifiedUsers: stats.unverifiedUsers,
        pendingScores: stats.pendingScores
      },
      recentActivity: {
        recentScores: recentScores.length,
        recentCompetitions: recentCompetitions.length
      },
      pendingActions: {
        pendingVerifications: pendingScores.length,
        unverifiedUsers: unverifiedUsers.length
      }
    };

    res.json({
      reports,
      message: 'Reports retrieved successfully'
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Failed to get reports' });
  }
});

// TODO: Add system settings management
// TODO: Add content moderation tools
// TODO: Add analytics and reporting features

// @route   GET /api/admin/range-admins
// @desc    Get all range admin accounts
// @access  Private (Admin only)
router.get('/range-admins', async (req, res) => {
  try {
    const rangeAdmins = await firebaseService.find('users', { role: 'range_admin' });

    // Remove passwords from response
    const safeRangeAdmins = rangeAdmins.map(admin => {
      const { password, ...safeAdmin } = admin;
      return safeAdmin;
    });

    res.json({
      rangeAdmins: safeRangeAdmins,
      message: 'Range admins retrieved successfully'
    });
  } catch (error) {
    console.error('Get range admins error:', error);
    res.status(500).json({ error: 'Failed to get range admins' });
  }
});

module.exports = router;
