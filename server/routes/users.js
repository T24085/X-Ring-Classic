const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireRole } = require('../middleware/auth');
const firebaseService = require('../services/firebase');

const router = express.Router();

// @route   GET /api/users/profile/:userId
// @desc    Get user profile
// @access  Public
router.get('/profile/:userId', async (req, res) => {
  try {
    const user = await firebaseService.getById('users', req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Calculate user's classification based on their scores
    let classification = 'Unclassified';
    let classificationTier = 'Unclassified';
    let isProvisional = true;
    let averageScore = null;
    let bestScore = null;
    let totalCompetitions = 0;
    
    try {
      const userScores = await firebaseService.getScoresByUser(req.params.userId);
      if (Array.isArray(userScores) && userScores.length > 0) {
        const valid = userScores.map(s => s.score).filter(v => typeof v === 'number');
        if (valid.length > 0) {
          averageScore = valid.reduce((a, b) => a + b, 0) / valid.length;
          bestScore = Math.max(...valid);
        }
        totalCompetitions = new Set(userScores.map(s => s.competitionId)).size;
        
        // Use enhanced classification with provisional logic
        const { getClassificationFromScores } = require('../services/classification');
        const resClass = getClassificationFromScores(userScores, { windowDays: 365, considerN: 10, bestK: 6, minFull: 6 });
        classification = resClass.classificationLabel;
        classificationTier = resClass.tier;
        isProvisional = !!resClass.provisional;
      }
    } catch (error) {
      console.log('Could not calculate classification for user:', req.params.userId, error.message);
    }

    // Remove sensitive information and add calculated fields
    const { password, ...userProfile } = user;
    const enhancedProfile = {
      ...userProfile,
      classification,
      classificationTier,
      isProvisional,
      averageScore,
      bestScore,
      totalCompetitions
    };

    res.json({ user: enhancedProfile });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

// @route   PUT /api/users/profile
// @desc    Update current user's profile
// @access  Private
router.put('/profile', [
  authenticateToken,
  body('firstName')
    .optional()
    .isLength({ max: 50 })
    .withMessage('First name must be less than 50 characters'),
  body('lastName')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Last name must be less than 50 characters'),
  body('phone')
    .optional()
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage('Phone number must be valid'),
  body('location')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Location must be less than 100 characters'),
  body('bio')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Bio must be less than 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await firebaseService.getById('users', req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = await firebaseService.update('users', req.user.userId, req.body);

    // Remove password from response
    const { password, ...userWithoutPassword } = updatedUser;

    res.json({
      message: 'Profile updated successfully',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// @route   GET /api/users/:userId/scores
// @desc    Get user's scores
// @access  Public
router.get('/:userId/scores', async (req, res) => {
  try {
    const scores = await firebaseService.getScoresByUser(req.params.userId);

    // Populate competition information
    const scoresWithCompetitions = await Promise.all(
      scores.map(async (score) => {
        const competition = await firebaseService.getById('competitions', score.competitionId);
        return {
          ...score,
          competition: competition ? {
            id: competition.id,
            title: competition.title,
            competitionType: competition.competitionType,
            format: competition.format
          } : null
        };
      })
    );

    res.json({ scores: scoresWithCompetitions });
  } catch (error) {
    console.error('Get user scores error:', error);
    res.status(500).json({ error: 'Failed to get user scores' });
  }
});

// @route   GET /api/users/:userId/competitions
// @desc    Get user's competitions
// @access  Public
router.get('/:userId/competitions', async (req, res) => {
  try {
    const user = await firebaseService.getById('users', req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get competitions where user is organizer
    const organizedCompetitions = await firebaseService.getCompetitionsByOrganizer(req.params.userId);

    // Get competitions where user has submitted scores
    const userScores = await firebaseService.getScoresByUser(req.params.userId);
    const competitionIds = [...new Set(userScores.map(score => score.competitionId))];
    
    const participatedCompetitions = await Promise.all(
      competitionIds.map(id => firebaseService.getById('competitions', id))
    );

    // Get competitions where user is registered (via registrations collection)
    const registrations = await firebaseService.find('registrations', { userId: req.params.userId });
    const registeredCompetitionIds = [...new Set(registrations.map(r => r.competitionId))];
    const registeredCompetitions = await Promise.all(
      registeredCompetitionIds.map(id => firebaseService.getById('competitions', id))
    );

    // Combined convenience field for clients expecting a flat list
    const combinedMap = new Map();
    for (const comp of organizedCompetitions) { if (comp) combinedMap.set(comp.id, comp); }
    for (const comp of participatedCompetitions) { if (comp) combinedMap.set(comp.id, comp); }
    for (const comp of registeredCompetitions) { if (comp) combinedMap.set(comp.id, comp); }
    const combinedCompetitions = Array.from(combinedMap.values());

    res.json({
      organized: organizedCompetitions,
      participated: participatedCompetitions.filter(Boolean),
      registered: registeredCompetitions.filter(Boolean),
      competitions: combinedCompetitions
    });
  } catch (error) {
    console.error('Get user competitions error:', error);
    res.status(500).json({ error: 'Failed to get user competitions' });
  }
});

// @route   GET /api/users/search
// @desc    Search users
// @access  Public
router.get('/search', async (req, res) => {
  try {
    const { q, role, limit = 10 } = req.query;

    let users = [];
    
    if (q) {
      // Search by username or name
      const allUsers = await firebaseService.find('users', {});
      users = allUsers.filter(user => 
        user.username?.toLowerCase().includes(q.toLowerCase()) ||
        user.firstName?.toLowerCase().includes(q.toLowerCase()) ||
        user.lastName?.toLowerCase().includes(q.toLowerCase())
      );
    } else {
      users = await firebaseService.find('users', { limit: parseInt(limit) });
    }

    // Filter by role if specified
    if (role) {
      users = users.filter(user => user.role === role);
    }

    // Remove sensitive information
    const safeUsers = users.map(user => {
      const { password, ...safeUser } = user;
      return safeUser;
    });

    res.json({ users: safeUsers });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// @route   GET /api/users/top-shooters
// @desc    Get top shooters
// @access  Public
router.get('/top-shooters', async (req, res) => {
  try {
    const { type = 'overall', limit = 10 } = req.query;

    // Get top scores
    const topScores = await firebaseService.getLeaderboard(type, parseInt(limit));

    // Get unique user IDs from top scores
    const userIds = [...new Set(topScores.map(score => score.competitorId))];

    // Get user details
    const users = await Promise.all(
      userIds.map(id => firebaseService.getById('users', id))
    );

    // Create leaderboard with user details
    // Compute classification per user (based on average score)
    const { getClassificationFromAverage } = require('../services/classification');
    const leaderboard = await Promise.all(
      topScores.map(async (score) => {
        const user = users.find(u => u?.id === score.competitorId);
        let avgScore = null;
        let bestScore = null;
        let competitionsCount = 0;
        try {
          const userScores = await firebaseService.getScoresByUser(score.competitorId);
          if (Array.isArray(userScores) && userScores.length > 0) {
            const valid = userScores.map(s => s.score).filter(v => typeof v === 'number');
            if (valid.length > 0) {
              avgScore = valid.reduce((a, b) => a + b, 0) / valid.length;
              bestScore = Math.max(...valid);
            }
            competitionsCount = new Set(userScores.map(s => s.competitionId)).size;
          }
        } catch (_) {}
        const classification = getClassificationFromAverage(avgScore ?? score.score);

        return {
          ...score,
          averageScore: avgScore ?? score.score,
          bestScore: bestScore ?? score.score,
          competitionsCount,
          user: user ? {
            id: user.id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            classification
          } : null
        };
      })
    );

    res.json({ leaderboard });
  } catch (error) {
    console.error('Get top shooters error:', error);
    res.status(500).json({ error: 'Failed to get top shooters' });
  }
});

// Admin routes
// @route   PUT /api/users/:userId/verify
// @desc    Verify user (Admin only)
// @access  Private
router.put('/:userId/verify', [
  authenticateToken,
  requireRole(['admin'])
], async (req, res) => {
  try {
    const user = await firebaseService.getById('users', req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await firebaseService.update('users', req.params.userId, {
      isVerified: true,
      verificationStatus: 'verified'
    });

    res.json({ message: 'User verified successfully' });
  } catch (error) {
    console.error('Verify user error:', error);
    res.status(500).json({ error: 'Failed to verify user' });
  }
});

// @route   PUT /api/users/:userId/deactivate
// @desc    Deactivate user (Admin only)
// @access  Private
router.put('/:userId/deactivate', [
  authenticateToken,
  requireRole(['admin'])
], async (req, res) => {
  try {
    const user = await firebaseService.getById('users', req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await firebaseService.update('users', req.params.userId, {
      isActive: false
    });

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
});

// @route   DELETE /api/users/:userId
// @desc    Permanently delete a user and their data (Admin only)
// @access  Private
router.delete('/:userId', [
  authenticateToken,
  requireRole(['admin'])
], async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await firebaseService.getById('users', userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete user scores
    try {
      const scores = await firebaseService.getScoresByUser(userId);
      for (const s of scores) {
        await firebaseService.delete('scores', s.id);
      }
    } catch (e) {
      console.warn('Failed cleaning scores for user', userId, e.message);
    }

    // Delete registrations
    try {
      const regs = await firebaseService.find('registrations', { userId });
      for (const r of regs) {
        await firebaseService.delete('registrations', r.id);
      }
    } catch (e) {
      console.warn('Failed cleaning registrations for user', userId, e.message);
    }

    // Best-effort: remove from competitions participants arrays (no-op if not present)
    try {
      const comps = await firebaseService.find('competitions', {});
      for (const c of comps) {
        if (Array.isArray(c.participants)) {
          const before = c.participants.length;
          const filtered = c.participants.filter(p => p.userId !== userId);
          if (filtered.length !== before) {
            const participantCount = Math.max(0, (c.participantCount || filtered.length));
            await firebaseService.update('competitions', c.id, {
              participants: filtered,
              participantCount: filtered.length,
              registeredCount: filtered.length
            });
          }
        }
      }
    } catch (e) {
      console.warn('Failed updating competitions while deleting user', userId, e.message);
    }

    // Finally delete user document
    await firebaseService.delete('users', userId);

    res.json({ message: 'User and associated data deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// @route   PUT /api/users/:userId/role
// @desc    Update user role (Admin only)
// @access  Private
router.put('/:userId/role', [
  authenticateToken,
  requireRole(['admin']),
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

module.exports = router;
