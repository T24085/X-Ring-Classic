const express = require('express');
const firebaseService = require('../services/firebase');
const { getClassificationFromAverage, getClassificationFromCard } = require('../services/classification');

// Helper to cache competitions and compute normalization for classification
const competitionCache = new Map();
async function getCompetitionCached(id) {
  if (!id) return null;
  if (competitionCache.has(id)) return competitionCache.get(id);
  const comp = await firebaseService.getById('competitions', id);
  competitionCache.set(id, comp);
  return comp;
}

function scoreToPercent(score, competition) {
  const shots = competition?.shotsPerTarget || 10;
  const maxPoints = shots * 10;
  if (!maxPoints || maxPoints <= 0) return null;
  return Math.max(0, Math.min(100, (score / maxPoints) * 100));
}

function normalizeTo250(score, competition, scoreObj) {
  // Prefer competition.shotsPerTarget, fallback to score.shots length, else 10
  const shots = (competition && competition.shotsPerTarget) ||
                (Array.isArray(scoreObj?.shots) ? scoreObj.shots.length : 10);
  const maxPoints = shots * 10;
  if (!maxPoints || !Number.isFinite(score)) return null;
  const to250 = (score / maxPoints) * 250;
  return Math.max(0, Math.min(250, to250));
}

const router = express.Router();

// @route   GET /api/leaderboards/indoor
// @desc    Get indoor leaderboard
// @access  Public
router.get('/indoor', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const scores = await firebaseService.getLeaderboard('indoor', parseInt(limit));

    // Populate competitor information
    const leaderboard = await Promise.all(
      scores.map(async (score, index) => {
        const competitor = await firebaseService.getById('users', score.competitorId);
        // Compute stats across user's submissions
        let avgScore = null;
        let bestScore = null;
        let competitionsCount = 0;
        let classification = 'Unclassified';
        try {
          const userScores = await firebaseService.getScoresByUser(score.competitorId);
          if (Array.isArray(userScores) && userScores.length > 0) {
            const valid = userScores.map(s => s.score).filter(v => typeof v === 'number');
            if (valid.length > 0) {
              avgScore = valid.reduce((a, b) => a + b, 0) / valid.length;
              bestScore = Math.max(...valid);
            }
            competitionsCount = new Set(userScores.map(s => s.competitionId)).size;

            // Classification based on per-card average (to 250) and avg X-count
            const toCardPoints = await Promise.all(userScores.map(async (s) => {
              const comp = await getCompetitionCached(s.competitionId);
              const to250 = normalizeTo250(s.score, comp, s);
              return { to250, x: s?.tiebreakerData?.xCount || 0 };
            }));
            const validPoints = toCardPoints.filter(p => Number.isFinite(p.to250));
            const avgPoints250 = validPoints.length > 0 ? validPoints.reduce((a, b) => a + b.to250, 0) / validPoints.length : null;
            const avgXCount = validPoints.length > 0 ? validPoints.reduce((a, b) => a + b.x, 0) / validPoints.length : 0;
            classification = getClassificationFromCard(avgPoints250, avgXCount);
          }
        } catch (_) {}

        // Allow admin override from user record if provided
        const finalClassification = (competitor?.classificationOverride || competitor?.manualClassification) || classification;

        return {
          rank: index + 1,
          score: score.score,
          averageScore: avgScore ?? score.score,
          bestScore: bestScore ?? score.score,
          competitionsCount,
          tiebreakerData: score.tiebreakerData,
          competitionId: score.competitionId,
          competitor: competitor ? {
            id: competitor.id,
            username: competitor.username,
            firstName: competitor.firstName,
            lastName: competitor.lastName,
            classification: finalClassification
          } : null
        };
      })
    );

    res.json({ leaderboard });
  } catch (error) {
    console.error('Get indoor leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get indoor leaderboard' });
  }
});

// @route   GET /api/leaderboards/outdoor
// @desc    Get outdoor leaderboard
// @access  Public
router.get('/outdoor', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const scores = await firebaseService.getLeaderboard('outdoor', parseInt(limit));

    // Populate competitor information
    const leaderboard = await Promise.all(
      scores.map(async (score, index) => {
        const competitor = await firebaseService.getById('users', score.competitorId);
        let avgScore = null;
        let bestScore = null;
        let competitionsCount = 0;
        let classification = 'Unclassified';
        try {
          const userScores = await firebaseService.getScoresByUser(score.competitorId);
          if (Array.isArray(userScores) && userScores.length > 0) {
            const valid = userScores.map(s => s.score).filter(v => typeof v === 'number');
            if (valid.length > 0) {
              avgScore = valid.reduce((a, b) => a + b, 0) / valid.length;
              bestScore = Math.max(...valid);
            }
            competitionsCount = new Set(userScores.map(s => s.competitionId)).size;

            const toCardPoints = await Promise.all(userScores.map(async (s) => {
              const comp = await getCompetitionCached(s.competitionId);
              const to250 = normalizeTo250(s.score, comp, s);
              return { to250, x: s?.tiebreakerData?.xCount || 0 };
            }));
            const validPoints = toCardPoints.filter(p => Number.isFinite(p.to250));
            const avgPoints250 = validPoints.length > 0 ? validPoints.reduce((a, b) => a + b.to250, 0) / validPoints.length : null;
            const avgXCount = validPoints.length > 0 ? validPoints.reduce((a, b) => a + b.x, 0) / validPoints.length : 0;
            classification = getClassificationFromCard(avgPoints250, avgXCount);
          }
        } catch (_) {}

        return {
          rank: index + 1,
          score: score.score,
          averageScore: avgScore ?? score.score,
          bestScore: bestScore ?? score.score,
          competitionsCount,
          tiebreakerData: score.tiebreakerData,
          competitionId: score.competitionId,
          competitor: competitor ? {
            id: competitor.id,
            username: competitor.username,
            firstName: competitor.firstName,
            lastName: competitor.lastName,
            classification
          } : null
        };
      })
    );

    res.json({ leaderboard });
  } catch (error) {
    console.error('Get outdoor leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get outdoor leaderboard' });
  }
});

// @route   GET /api/leaderboards/competition/:competitionId
// @desc    Get competition leaderboard
// @access  Public
router.get('/competition/:competitionId', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const scoresRaw = await firebaseService.getScoresByCompetition(req.params.competitionId);
    const scores = scoresRaw.filter(s => (s.verificationStatus ?? 'approved') === 'approved');
    const competition = await getCompetitionCached(req.params.competitionId);

    // Deduplicate: keep best score per competitor within this competition
    const bestMap = new Map();
    const better = (a, b) => {
      if (!a) return b;
      if (!b) return a;
      if (b.score !== a.score) return b.score > a.score ? b : a;
      const ax = a.tiebreakerData?.xCount || 0;
      const bx = b.tiebreakerData?.xCount || 0;
      if (bx !== ax) return bx > ax ? b : a;
      const at = a.tiebreakerData?.totalTime || 0;
      const bt = b.tiebreakerData?.totalTime || 0;
      return bt < at ? b : a; // faster time wins
    };
    for (const s of scores) {
      const key = s.competitorId;
      bestMap.set(key, better(bestMap.get(key), s));
    }
    const sortedScores = Array.from(bestMap.values()).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ax = a.tiebreakerData?.xCount || 0;
      const bx = b.tiebreakerData?.xCount || 0;
      if (bx !== ax) return bx - ax;
      return (a.tiebreakerData?.totalTime || 0) - (b.tiebreakerData?.totalTime || 0);
    }).slice(0, parseInt(limit));

    // Populate competitor information
    const leaderboard = await Promise.all(
      sortedScores.map(async (score, index) => {
        const competitor = await firebaseService.getById('users', score.competitorId);
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
        // Classify by this competition's card score and Xs
        const to250 = normalizeTo250(score.score, competition, score);
        const x = score?.tiebreakerData?.xCount || 0;
        const classification = getClassificationFromCard(to250, x);

        const finalClassification = (competitor?.classificationOverride || competitor?.manualClassification) || classification;
        return {
          rank: index + 1,
          score: score.score,
          averageScore: avgScore ?? score.score,
          bestScore: bestScore ?? score.score,
          competitionsCount,
          tiebreakerData: score.tiebreakerData,
          verificationStatus: score.verificationStatus,
          competitor: competitor ? {
            id: competitor.id,
            username: competitor.username,
            firstName: competitor.firstName,
            lastName: competitor.lastName,
            classification: finalClassification
          } : null
        };
      })
    );

    res.json({ leaderboard });
  } catch (error) {
    console.error('Get competition leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get competition leaderboard' });
  }
});

// @route   GET /api/leaderboards/format/:format
// @desc    Get leaderboard by format (prone, standing, benchrest)
// @access  Public
router.get('/format/:format', async (req, res) => {
  try {
    const { format } = req.params;
    const { limit = 50 } = req.query;

    if (!['prone', 'standing', 'benchrest'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format. Must be prone, standing, or benchrest' });
    }

    // Get all scores and filter by format
    const allScores = (await firebaseService.find('scores', {})).filter(s => (s.verificationStatus ?? 'approved') === 'approved');
    
    // Get competitions with the specified format
    const competitions = await firebaseService.find('competitions', { format });
    const competitionIds = competitions.map(c => c.id);
    
    // Filter scores by competition format
    const formatScores = allScores.filter(score => competitionIds.includes(score.competitionId));

    // Deduplicate by competitor: keep their best score within this format
    const bestMap = new Map();
    const better = (a, b) => {
      if (!a) return b;
      if (!b) return a;
      if (b.score !== a.score) return b.score > a.score ? b : a;
      const ax = a.tiebreakerData?.xCount || 0;
      const bx = b.tiebreakerData?.xCount || 0;
      if (bx !== ax) return bx > ax ? b : a;
      const at = a.tiebreakerData?.totalTime || 0;
      const bt = b.tiebreakerData?.totalTime || 0;
      return bt < at ? b : a;
    };
    for (const s of formatScores) {
      const key = s.competitorId;
      bestMap.set(key, better(bestMap.get(key), s));
    }
    const sortedScores = Array.from(bestMap.values())
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const ax = a.tiebreakerData?.xCount || 0;
        const bx = b.tiebreakerData?.xCount || 0;
        if (bx !== ax) return bx - ax;
        return (a.tiebreakerData?.totalTime || 0) - (b.tiebreakerData?.totalTime || 0);
      })
      .slice(0, parseInt(limit));

    // Populate competitor information
    const leaderboard = await Promise.all(
      sortedScores.map(async (score, index) => {
        const competitor = await firebaseService.getById('users', score.competitorId);
        let avgScore = null;
        let bestScore = null;
        let competitionsCount = 0;
        let classification = 'Unclassified';
        try {
          const userScores = await firebaseService.getScoresByUser(score.competitorId);
          if (Array.isArray(userScores) && userScores.length > 0) {
            const valid = userScores.map(s => s.score).filter(v => typeof v === 'number');
            if (valid.length > 0) {
              avgScore = valid.reduce((a, b) => a + b, 0) / valid.length;
              bestScore = Math.max(...valid);
            }
            competitionsCount = new Set(userScores.map(s => s.competitionId)).size;

            const toCardPoints = await Promise.all(userScores.map(async (s) => {
              const comp = await getCompetitionCached(s.competitionId);
              const to250 = normalizeTo250(s.score, comp, s);
              return { to250, x: s?.tiebreakerData?.xCount || 0 };
            }));
            const validPoints = toCardPoints.filter(p => Number.isFinite(p.to250));
            const avgPoints250 = validPoints.length > 0 ? validPoints.reduce((a, b) => a + b.to250, 0) / validPoints.length : null;
            const avgXCount = validPoints.length > 0 ? validPoints.reduce((a, b) => a + b.x, 0) / validPoints.length : 0;
            classification = getClassificationFromCard(avgPoints250, avgXCount);
          }
        } catch (_) {}

        const finalClassification = (competitor?.classificationOverride || competitor?.manualClassification) || classification;
        return {
          rank: index + 1,
          score: score.score,
          averageScore: avgScore ?? score.score,
          bestScore: bestScore ?? score.score,
          competitionsCount,
          tiebreakerData: score.tiebreakerData,
          competitionId: score.competitionId,
          competitor: competitor ? {
            id: competitor.id,
            username: competitor.username,
            firstName: competitor.firstName,
            lastName: competitor.lastName,
            classification: finalClassification
          } : null
        };
      })
    );

    res.json({ leaderboard });
  } catch (error) {
    console.error('Get format leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get format leaderboard' });
  }
});

// @route   GET /api/leaderboards/overall
// @desc    Get overall leaderboard
// @access  Public
router.get('/overall', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const scores = await firebaseService.getLeaderboard('overall', parseInt(limit));

    // Populate competitor information
    const leaderboard = await Promise.all(
      scores.map(async (score, index) => {
        const competitor = await firebaseService.getById('users', score.competitorId);
        let avgScore = null;
        let bestScore = null;
        let competitionsCount = 0;
        let classification = 'Unclassified';
        try {
          const userScores = await firebaseService.getScoresByUser(score.competitorId);
          if (Array.isArray(userScores) && userScores.length > 0) {
            const valid = userScores.map(s => s.score).filter(v => typeof v === 'number');
            if (valid.length > 0) {
              avgScore = valid.reduce((a, b) => a + b, 0) / valid.length;
              bestScore = Math.max(...valid);
            }
            competitionsCount = new Set(userScores.map(s => s.competitionId)).size;

            // Normalize each card to 250 and compute avg X-count
            const toCardPoints = await Promise.all(userScores.map(async (s) => {
              const comp = await getCompetitionCached(s.competitionId);
              const to250 = normalizeTo250(s.score, comp, s);
              return { to250, x: s?.tiebreakerData?.xCount || 0 };
            }));
            const validPoints = toCardPoints.filter(p => Number.isFinite(p.to250));
            const avgPoints250 = validPoints.length > 0 ? validPoints.reduce((a, b) => a + b.to250, 0) / validPoints.length : null;
            const avgXCount = validPoints.length > 0 ? validPoints.reduce((a, b) => a + b.x, 0) / validPoints.length : 0;
            classification = getClassificationFromCard(avgPoints250, avgXCount);
          }
        } catch (_) {}

        const finalClassification = (competitor?.classificationOverride || competitor?.manualClassification) || classification;
        return {
          rank: index + 1,
          score: score.score,
          averageScore: avgScore ?? score.score,
          bestScore: bestScore ?? score.score,
          competitionsCount,
          tiebreakerData: score.tiebreakerData,
          competitionId: score.competitionId,
          competitor: competitor ? {
            id: competitor.id,
            username: competitor.username,
            firstName: competitor.firstName,
            lastName: competitor.lastName,
            classification: finalClassification
          } : null
        };
      })
    );

    // Filter out any entries where competitor is null
    const validLeaderboard = leaderboard.filter(entry => entry.competitor !== null);

    res.json({ leaderboard: validLeaderboard });
  } catch (error) {
    console.error('Get overall leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get overall leaderboard' });
  }
});

// @route   POST /api/leaderboards/seed
// @desc    Create sample leaderboard data for testing
// @access  Public (for development only)
router.post('/seed', async (req, res) => {
  try {
    // First, create some sample users if they don't exist
    const sampleUsers = [
      {
        username: 'marksman_joe',
        firstName: 'Joe',
        lastName: 'Smith',
        email: 'joe@example.com',
        role: 'competitor',
        isActive: true,
        isVerified: true
      },
      {
        username: 'precision_mary',
        firstName: 'Mary',
        lastName: 'Johnson',
        email: 'mary@example.com',
        role: 'competitor',
        isActive: true,
        isVerified: true
      },
      {
        username: 'sharpshooter_bob',
        firstName: 'Bob',
        lastName: 'Wilson',
        email: 'bob@example.com',
        role: 'competitor',
        isActive: true,
        isVerified: true
      }
    ];

    const createdUsers = [];
    for (const user of sampleUsers) {
      const existingUser = await firebaseService.findUserByEmail(user.email);
      if (!existingUser) {
        const created = await firebaseService.create('users', user);
        createdUsers.push(created);
      } else {
        createdUsers.push(existingUser);
      }
    }

    // Get the first competition for reference
    const competitions = await firebaseService.find('competitions', {});
    if (competitions.length === 0) {
      return res.status(400).json({ error: 'No competitions found. Please create competitions first.' });
    }

    const competition = competitions[0];

    // Create sample scores
    const sampleScores = [
      {
        competitorId: createdUsers[0].id,
        competitionId: competition.id,
        score: 95,
        tiebreakerData: { totalTime: 120 },
        verificationStatus: 'verified',
        submittedAt: new Date().toISOString()
      },
      {
        competitorId: createdUsers[1].id,
        competitionId: competition.id,
        score: 92,
        tiebreakerData: { totalTime: 135 },
        verificationStatus: 'verified',
        submittedAt: new Date().toISOString()
      },
      {
        competitorId: createdUsers[2].id,
        competitionId: competition.id,
        score: 89,
        tiebreakerData: { totalTime: 150 },
        verificationStatus: 'verified',
        submittedAt: new Date().toISOString()
      }
    ];

    const createdScores = [];
    for (const score of sampleScores) {
      const created = await firebaseService.create('scores', score);
      createdScores.push(created);
    }

    res.json({
      message: 'Sample leaderboard data created successfully',
      users: createdUsers,
      scores: createdScores
    });
  } catch (error) {
    console.error('Seed leaderboard error:', error);
    res.status(500).json({ error: 'Failed to create sample leaderboard data' });
  }
});

module.exports = router;
