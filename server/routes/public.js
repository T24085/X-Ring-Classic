const express = require('express');
const firebaseService = require('../services/firebase');

const router = express.Router();

// Public stats for landing page
router.get('/stats', async (req, res) => {
  try {
    const stats = await firebaseService.getSystemStats();

    // Derive ranges partnered by unique range name in competitions
    let rangesPartnered = 0;
    try {
      const competitions = await firebaseService.find('competitions', {});
      const set = new Set();
      for (const c of competitions) {
        const name = c?.range?.name || c?.rangeName || c?.location;
        if (name) set.add(String(name).trim().toLowerCase());
      }
      rangesPartnered = set.size;
    } catch (_) {}

    res.json({
      activeCompetitions: stats.activeCompetitions || stats.publishedCompetitions || 0,
      totalUsers: stats.totalUsers || 0,
      totalScores: stats.totalScores || 0,
      rangesPartnered,
    });
  } catch (error) {
    console.error('Public stats error:', error);
    res.status(500).json({ error: 'Failed to load statistics' });
  }
});

module.exports = router;

