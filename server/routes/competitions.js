const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireRole, requireCompetitionOwnership } = require('../middleware/auth');
const firebaseService = require('../services/firebase');

const router = express.Router();

// @route   GET /api/competitions
// @desc    Get all competitions with filters
// @access  Public
router.get('/', async (req, res) => {
  try {
    const {
      type,
      status,
      location,
      dateFrom,
      dateTo,
      format,
      page = 1,
      limit = 10
    } = req.query;

    const filter = {};

    if (type && type !== 'all') filter.type = type;
    if (status && status !== 'all') filter.status = status;
    if (format && format !== 'all') filter.format = format;
    if (location && location !== 'all') filter.location = location;

    // Note: Date filtering will need to be implemented differently with Firestore
    // For now, we'll get all competitions and filter in memory
    let competitions = await firebaseService.find('competitions', filter);

    // Apply date filtering if needed
    if (dateFrom || dateTo) {
      competitions = competitions.filter(comp => {
        const compDate = new Date(comp.schedule?.competitionDate);
        if (dateFrom && compDate < new Date(dateFrom)) return false;
        if (dateTo && compDate > new Date(dateTo)) return false;
        return true;
      });
    }

    // Sort by competition date
    competitions.sort((a, b) => new Date(a.schedule?.competitionDate) - new Date(b.schedule?.competitionDate));

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
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get competitions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/competitions/:id
// @desc    Get competition by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const competition = await firebaseService.getById('competitions', req.params.id);

    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    // Populate organizer information
    if (competition.organizerId) {
      const organizer = await firebaseService.getById('users', competition.organizerId);
      competition.organizer = organizer ? {
        id: organizer.id,
        username: organizer.username,
        firstName: organizer.firstName,
        lastName: organizer.lastName
      } : null;
    }

    res.json({ competition });
  } catch (error) {
    console.error('Get competition error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/competitions/:id
// @desc    Update competition
// @access  Private (Organizer & Admins)
router.put('/:id', [
  authenticateToken,
  requireCompetitionOwnership
], async (req, res) => {
  try {
    const existing = await firebaseService.getById('competitions', req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    const allowedFields = [
      'title', 'description', 'status', 'format', 'maxParticipants', 'prizePool',
      'shotsPerTarget', 'competitionType', 'maxDistance', 'rules', 'equipment',
      'range', 'schedule', 'distance'
    ];
    const updateData = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) updateData[key] = req.body[key];
    }
    updateData.updatedAt = new Date().toISOString();

    await firebaseService.update('competitions', req.params.id, updateData);
    const updated = await firebaseService.getById('competitions', req.params.id);
    res.json({ message: 'Competition updated successfully', competition: updated });
  } catch (error) {
    console.error('Update competition error:', error);
    res.status(500).json({ error: 'Failed to update competition' });
  }
});

// @route   DELETE /api/competitions/:id
// @desc    Delete competition
// @access  Private (Organizer & Admins)
router.delete('/:id', [
  authenticateToken,
  requireCompetitionOwnership
], async (req, res) => {
  try {
    const existing = await firebaseService.getById('competitions', req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Competition not found' });
    }
    await firebaseService.delete('competitions', req.params.id);
    res.json({ message: 'Competition deleted successfully' });
  } catch (error) {
    console.error('Delete competition error:', error);
    res.status(500).json({ error: 'Failed to delete competition' });
  }
});

// @route   POST /api/competitions
// @desc    Create a new competition
// @access  Private (Range Officers & Admins)
router.post('/', [
  authenticateToken,
  requireRole(['range_admin', 'admin']),
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 100 })
    .withMessage('Title must be less than 100 characters'),
  body('description')
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('competitionType')
    .isIn(['indoor', 'outdoor'])
    .withMessage('Competition type must be indoor or outdoor'),
  body('maxDistance')
    .isIn([25, 50])
    .withMessage('Max distance must be 25 or 50 yards'),
  body('format')
    .isIn(['prone', 'standing', 'benchrest'])
    .withMessage('Format must be prone, standing, or benchrest'),
  body('schedule.competitionDate')
    .isISO8601()
    .withMessage('Competition date must be a valid date'),
  body('range.name')
    .notEmpty()
    .withMessage('Range name is required'),
  body('range.address')
    .notEmpty()
    .withMessage('Range address is required')
], async (req, res) => {
  try {
    console.log('Received competition data:', JSON.stringify(req.body, null, 2));
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const competitionData = {
      ...req.body,
      organizerId: req.user.userId,
      status: 'draft',
      participants: [],
      participantCount: 0,
      // TODO: sponsor prize integration
      prizes: req.body.prizes || [],
      // TODO: weatherInfo for outdoor competitions
      // TODO: streaming capabilities
    };

    const competition = await firebaseService.create('competitions', competitionData);

    res.status(201).json({
      message: 'Competition created successfully',
      competition
    });
  } catch (error) {
    console.error('Create competition error:', error);
    res.status(500).json({ error: 'Failed to create competition' });
  }
});



// @route   DELETE /api/competitions/:id
// @desc    Delete competition
// @access  Private (Organizer & Admins)
router.delete('/:id', [
  authenticateToken,
  requireCompetitionOwnership
], async (req, res) => {
  try {
    const competition = await firebaseService.getById('competitions', req.params.id);
    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    await firebaseService.delete('competitions', req.params.id);

    res.json({ message: 'Competition deleted successfully' });
  } catch (error) {
    console.error('Delete competition error:', error);
    res.status(500).json({ error: 'Failed to delete competition' });
  }
});

// @route   POST /api/competitions/:id/publish
// @desc    Publish competition
// @access  Private (Organizer & Admins)
router.post('/:id/publish', [
  authenticateToken,
  requireCompetitionOwnership
], async (req, res) => {
  try {
    const competition = await firebaseService.getById('competitions', req.params.id);
    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    if (competition.status === 'published') {
      return res.status(400).json({ error: 'Competition is already published' });
    }

    await firebaseService.update('competitions', req.params.id, { status: 'published' });

    res.json({ message: 'Competition published successfully' });
  } catch (error) {
    console.error('Publish competition error:', error);
    res.status(500).json({ error: 'Failed to publish competition' });
  }
});

// @route   POST /api/competitions/:id/register
// @desc    Register for competition
// @access  Private
router.post('/:id/register', [
  authenticateToken
], async (req, res) => {
  try {
    const competition = await firebaseService.getById('competitions', req.params.id);
    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    if (competition.status !== 'published' && competition.status !== 'active') {
      return res.status(400).json({ error: 'Competition is not open for registration' });
    }

    // Check if already registered (query by user then filter to avoid index issues)
    const userRegs = await firebaseService.find('registrations', { userId: req.user.userId });
    const existingReg = (userRegs || []).find(r => r.competitionId === req.params.id);
    if (existingReg) {
      return res.status(400).json({ error: 'You are already registered for this competition' });
    }

    const currentCount = competition.participantCount || competition.registeredCount || (competition.participants?.length || 0);
    if (currentCount >= competition.maxParticipants) {
      return res.status(400).json({ error: 'Competition is full' });
    }

    // Create registration record
    const registration = await firebaseService.create('registrations', {
      competitionId: req.params.id,
      userId: req.user.userId,
      userName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.username,
      location: req.user.location || '',
      status: 'registered',
      registeredAt: new Date().toISOString()
    });

    // Update competition document with participants array and counts
    const participants = Array.isArray(competition.participants) ? competition.participants.slice() : [];
    participants.push({
      userId: req.user.userId,
      userName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.username,
      location: req.user.location || '',
      registeredAt: registration.registeredAt
    });

    await firebaseService.update('competitions', req.params.id, {
      participants,
      participantCount: currentCount + 1,
      registeredCount: (competition.registeredCount || currentCount) + 1
    });

    res.json({ message: 'Successfully registered for competition' });
  } catch (error) {
    console.error('Register for competition error:', error);
    res.status(500).json({ error: 'Failed to register for competition' });
  }
});

// @route   POST /api/competitions/seed
// @desc    Create sample competitions for testing
// @access  Public (for development only)
router.post('/seed', async (req, res) => {
  try {
    const sampleCompetitions = [
      {
        title: 'Spring Indoor Championship',
        description: 'Annual indoor precision shooting competition',
        type: 'indoor',
        status: 'published',
        location: 'Central Range Complex',
        startDate: new Date('2024-04-15').toISOString(),
        maxParticipants: 50,
        registeredCount: 12,
        prizePool: 2500,
        duration: '4 hours',
        distance: '25 yards',
        shotsPerTarget: 10
      },
      {
        title: 'Outdoor Precision Challenge',
        description: 'Challenging outdoor competition with varying distances',
        type: 'outdoor',
        status: 'published',
        location: 'Mountain View Range',
        startDate: new Date('2024-05-20').toISOString(),
        maxParticipants: 30,
        registeredCount: 8,
        prizePool: 1500,
        duration: '6 hours',
        distance: '50-100 yards',
        shotsPerTarget: 15
      },
      {
        title: 'Speed Shooting Tournament',
        description: 'Fast-paced competition testing speed and accuracy',
        type: 'speed',
        status: 'active',
        location: 'Urban Tactical Range',
        startDate: new Date('2024-06-10').toISOString(),
        maxParticipants: 40,
        registeredCount: 25,
        prizePool: 3000,
        duration: '3 hours',
        distance: '15 yards',
        shotsPerTarget: 20
      }
    ];

    const createdCompetitions = [];
    for (const comp of sampleCompetitions) {
      const created = await firebaseService.create('competitions', comp);
      createdCompetitions.push(created);
    }

    res.json({
      message: 'Sample competitions created successfully',
      competitions: createdCompetitions
    });
  } catch (error) {
    console.error('Seed competitions error:', error);
    res.status(500).json({ error: 'Failed to create sample competitions' });
  }
});

module.exports = router;
