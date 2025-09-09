const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireRole, requireRangeAdmin } = require('../middleware/auth');
const firebaseService = require('../services/firebase');

const router = express.Router();

// @route   POST /api/scores
// @desc    Submit a new score
// @access  Private
router.post('/', [
  authenticateToken,
  body('competitionId')
    .notEmpty()
    .withMessage('Competition ID is required'),
  // score is derived from shots server-side; no explicit bounds validation here
  body('shots')
    .isArray({ min: 1 })
    .withMessage('At least one shot is required'),
  body('shots.*.value')
    .isInt({ min: 0, max: 10 })
    .withMessage('Shot values must be between 0 and 10'),
  body('shots.*.isX')
    .optional()
    .isBoolean()
    .withMessage('isX must be a boolean'),
  body('equipment.rifle')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Rifle name must be less than 100 characters'),
  body('equipment.ammunition')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Ammunition must be less than 100 characters'),
  body('evidence.photoUrl')
    .optional()
    .isURL()
    .withMessage('Photo URL must be a valid URL'),
  body('evidence.videoUrl')
    .optional()
    .isURL()
    .withMessage('Video URL must be a valid URL'),
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      competitionId,
      score,
      shots,
      equipment,
      conditions,
      category,
      notes,
      evidence
    } = req.body;

    // Verify competition exists
    const competition = await firebaseService.getById('competitions', competitionId);
    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    // Check if competition is open for submissions
    if (competition.status !== 'published') {
      return res.status(400).json({ error: 'Competition is not open for submissions' });
    }

    // Check if user is registered for this competition
    const registrations = await firebaseService.find('registrations', {
      competitionId: competitionId,
      userId: req.user.userId
    });
    
    if (registrations.length === 0) {
      return res.status(403).json({ 
        error: 'You must register for this competition before submitting scores',
        requiresRegistration: true
      });
    }

    // Multiple submissions allowed: keep best on leaderboards

    // Enforce required shots count if defined
    const requiredShots = competition.shotsPerTarget || null;
    if (requiredShots && shots.length !== requiredShots) {
      return res.status(400).json({
        error: `Invalid number of shots: expected ${requiredShots}, received ${shots.length}`
      });
    }

    // For integrity, recompute total from shots
    const computedScore = Array.isArray(shots)
      ? shots.reduce((sum, s) => {
          const v = s && s.isX === true ? 10 : (parseInt(s?.value, 10) || 0);
          return sum + v;
        }, 0)
      : score;

    // Evidence is optional; range officers will verify

    // Calculate tiebreaker data (X-count primary tiebreaker)
    const xCount = shots.filter(shot => (shot?.isX === true)).length;
    const perfectShots = shots.filter(shot => (shot?.isX === true) || parseInt(shot.value, 10) === 10).length;
    const tiebreakerData = {
      totalTime: shots.reduce((sum, shot) => sum + (shot.time || 0), 0),
      perfectShots,
      xCount,
      // TODO: AI-powered shot analysis
    };

    const scoreData = {
      competitorId: req.user.userId,
      competitionId,
      score: computedScore,
      shots,
      tiebreakerData,
      equipment: equipment || {},
      conditions: conditions || {},
      category: category || 'open',
      notes: notes || '',
      evidence: evidence || null,
      verificationStatus: 'pending',
      verifiedBy: null,
      verifiedAt: null,
      // TODO: AI video analysis
    };

    const newScore = await firebaseService.create('scores', scoreData);

    res.status(201).json({
      message: 'Score submitted successfully',
      score: newScore
    });
  } catch (error) {
    console.error('Submit score error:', error);
    res.status(500).json({ error: 'Failed to submit score' });
  }
});

// @route   GET /api/scores/competition/:competitionId
// @desc    Get all scores for a competition
// @access  Public
router.get('/competition/:competitionId', async (req, res) => {
  try {
    const scores = await firebaseService.getScoresByCompetition(req.params.competitionId);

    // Populate competitor information
    const scoresWithCompetitors = await Promise.all(
      scores.map(async (score) => {
        const competitor = await firebaseService.getById('users', score.competitorId);
        return {
          ...score,
          competitor: competitor ? {
            id: competitor.id,
            username: competitor.username,
            firstName: competitor.firstName,
            lastName: competitor.lastName
          } : null
        };
      })
    );

    res.json({ scores: scoresWithCompetitors });
  } catch (error) {
    console.error('Get competition scores error:', error);
    res.status(500).json({ error: 'Failed to get competition scores' });
  }
});

// @route   GET /api/scores/user/:userId
// @desc    Get all scores for a user
// @access  Public
router.get('/user/:userId', async (req, res) => {
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

// @route   PUT /api/scores/:id/verify
// @desc    Verify a score (Range Admins & Admins)
// @access  Private
router.put('/:id/verify', [
  authenticateToken,
  requireRole(['range_admin', 'admin']),
  body('status')
    .isIn(['approved', 'rejected'])
    .withMessage('Status must be approved or rejected'),
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, notes } = req.body;

    const score = await firebaseService.getById('scores', req.params.id);
    if (!score) {
      return res.status(404).json({ error: 'Score not found' });
    }

    const updateData = {
      verificationStatus: status,
      verifiedBy: req.user.userId,
      verifiedAt: new Date(),
      verificationNotes: notes || ''
    };

    const updatedScore = await firebaseService.update('scores', req.params.id, updateData);

    res.json({
      message: `Score ${status} successfully`,
      score: updatedScore
    });
  } catch (error) {
    console.error('Verify score error:', error);
    res.status(500).json({ error: 'Failed to verify score' });
  }
});

// @route   PUT /api/scores/:id/flag
// @desc    Flag a score for review
// @access  Private
router.put('/:id/flag', [
  authenticateToken,
  body('reason')
    .notEmpty()
    .withMessage('Flag reason is required')
    .isLength({ max: 500 })
    .withMessage('Reason must be less than 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { reason } = req.body;

    const score = await firebaseService.getById('scores', req.params.id);
    if (!score) {
      return res.status(404).json({ error: 'Score not found' });
    }

    const updateData = {
      verificationStatus: 'flagged',
      flaggedBy: req.user.userId,
      flaggedAt: new Date(),
      flagReason: reason
    };

    const updatedScore = await firebaseService.update('scores', req.params.id, updateData);

    res.json({
      message: 'Score flagged for review',
      score: updatedScore
    });
  } catch (error) {
    console.error('Flag score error:', error);
    res.status(500).json({ error: 'Failed to flag score' });
  }
});

// @route   GET /api/scores/pending-verification
// @desc    Get scores pending verification (Range Admins & Admins)
// @access  Private
router.get('/pending-verification', [
  authenticateToken,
  requireRole(['range_admin', 'admin'])
], async (req, res) => {
  try {
    const scores = await firebaseService.getPendingVerificationScores();

    // Populate competitor and competition information
    const scoresWithDetails = await Promise.all(
      scores.map(async (score) => {
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

    res.json({ scores: scoresWithDetails });
  } catch (error) {
    console.error('Get pending verification scores error:', error);
    res.status(500).json({ error: 'Failed to get pending verification scores' });
  }
});

// @route   POST /api/scores/admin
// @desc    Submit a score on behalf of a competitor (Range Admins & Admins)
// @access  Private
router.post('/admin', [
  authenticateToken,
  requireRole(['range_admin', 'admin']),
  body('competitionId')
    .notEmpty()
    .withMessage('Competition ID is required'),
  body('competitorId')
    .notEmpty()
    .withMessage('Competitor ID is required'),
  // Score is computed from shots server-side to support variable shot counts
  body('shots')
    .isArray({ min: 1 })
    .withMessage('At least one shot is required'),
  body('shots.*.value')
    .isInt({ min: 0, max: 10 })
    .withMessage('Shot values must be between 0 and 10'),
  body('equipment.rifle')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Rifle name must be less than 100 characters'),
  body('equipment.ammunition')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Ammunition must be less than 100 characters'),
  body('evidence.photoUrl')
    .optional()
    .isURL()
    .withMessage('Photo URL must be a valid URL'),
  body('evidence.videoUrl')
    .optional()
    .isURL()
    .withMessage('Video URL must be a valid URL'),
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      competitionId,
      competitorId,
      shots,
      equipment,
      conditions,
      category,
      notes,
      evidence
    } = req.body;

    // Verify competition exists
    const competition = await firebaseService.getById('competitions', competitionId);
    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    // Verify competitor exists
    const competitor = await firebaseService.getById('users', competitorId);
    if (!competitor) {
      return res.status(404).json({ error: 'Competitor not found' });
    }

    // Check if competition is open for submissions
    if (competition.status !== 'published') {
      return res.status(400).json({ error: 'Competition is not open for submissions' });
    }

    // Enforce required shots count if defined
    const requiredShots = competition.shotsPerTarget || null;
    if (requiredShots && shots.length !== requiredShots) {
      return res.status(400).json({
        error: `Invalid number of shots: expected ${requiredShots}, received ${shots.length}`
      });
    }

    // Multiple submissions allowed; range admins may submit additional cards

    // Calculate tiebreaker data
    const tiebreakerData = {
      totalTime: shots.reduce((sum, shot) => sum + (shot.time || 0), 0),
      perfectShots: shots.filter(shot => parseInt(shot.value, 10) === 10 || shot.isX === true).length,
      xCount: shots.filter(shot => shot.isX === true).length,
    };

    // Compute score from shots for integrity
    const computedScore = Array.isArray(shots)
      ? shots.reduce((sum, s) => {
          const v = s && s.isX === true ? 10 : (parseInt(s?.value, 10) || 0);
          return sum + v;
        }, 0)
      : 0;

    const scoreData = {
      competitorId: competitorId,
      competitionId,
      score: computedScore,
      shots,
      tiebreakerData,
      equipment: equipment || {},
      conditions: conditions || {},
      category: category || 'open',
      notes: notes || '',
      evidence: evidence || null,
      verificationStatus: 'approved', // Auto-approve admin submissions
      verifiedBy: req.user.userId,
      verifiedAt: new Date(),
      submittedBy: req.user.userId, // Track who submitted on behalf
      submittedAt: new Date()
    };

    const newScore = await firebaseService.create('scores', scoreData);

    res.status(201).json({
      message: 'Score submitted successfully on behalf of competitor',
      score: newScore
    });
  } catch (error) {
    console.error('Admin submit score error:', error);
    res.status(500).json({ error: 'Failed to submit score' });
  }
});

module.exports = router;
