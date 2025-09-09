const admin = require('firebase-admin');

class FirebaseService {
  constructor() {
    this.db = admin.firestore();
  }

  // Generic CRUD operations
  async create(collection, data) {
    try {
      const docRef = await this.db.collection(collection).add({
        ...data,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return { id: docRef.id, ...data };
    } catch (error) {
      throw new Error(`Error creating document in ${collection}: ${error.message}`);
    }
  }

  async getById(collection, id) {
    try {
      const doc = await this.db.collection(collection).doc(id).get();
      if (!doc.exists) {
        return null;
      }
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      throw new Error(`Error getting document from ${collection}: ${error.message}`);
    }
  }

  async update(collection, id, data) {
    try {
      await this.db.collection(collection).doc(id).update({
        ...data,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return { id, ...data };
    } catch (error) {
      throw new Error(`Error updating document in ${collection}: ${error.message}`);
    }
  }

  async delete(collection, id) {
    try {
      await this.db.collection(collection).doc(id).delete();
      return { id };
    } catch (error) {
      throw new Error(`Error deleting document from ${collection}: ${error.message}`);
    }
  }

  async find(collection, query = {}) {
    try {
      let ref = this.db.collection(collection);
      
      // Apply filters
      Object.keys(query).forEach(key => {
        if (key !== 'limit' && key !== 'orderBy' && key !== 'orderDirection') {
          ref = ref.where(key, '==', query[key]);
        }
      });

      // Apply ordering
      if (query.orderBy) {
        ref = ref.orderBy(query.orderBy, query.orderDirection || 'desc');
      }

      // Apply limit
      if (query.limit) {
        ref = ref.limit(query.limit);
      }

      const snapshot = await ref.get();
      const documents = [];
      snapshot.forEach(doc => {
        documents.push({ id: doc.id, ...doc.data() });
      });
      return documents;
    } catch (error) {
      throw new Error(`Error finding documents in ${collection}: ${error.message}`);
    }
  }

  async findOne(collection, query = {}) {
    try {
      const documents = await this.find(collection, { ...query, limit: 1 });
      return documents.length > 0 ? documents[0] : null;
    } catch (error) {
      throw new Error(`Error finding document in ${collection}: ${error.message}`);
    }
  }

  // User-specific operations
  async findUserByEmail(email) {
    return this.findOne('users', { email });
  }

  async findUserByUsername(username) {
    return this.findOne('users', { username });
  }

  // Competition-specific operations
  async getPublishedCompetitions(limit = 10) {
    return this.find('competitions', { 
      status: 'published', 
      limit,
      orderBy: 'startDate',
      orderDirection: 'asc'
    });
  }

  async getCompetitionsByOrganizer(organizerId) {
    return this.find('competitions', { organizerId });
  }

  // Score-specific operations
  // Use a simple equality query and sort in memory to avoid
  // requiring composite Firestore indexes in local/dev setups.
  async getScoresByCompetition(competitionId) {
    try {
      const snapshot = await this.db.collection('scores')
        .where('competitionId', '==', competitionId)
        .get();

      const documents = [];
      snapshot.forEach(doc => {
        documents.push({ id: doc.id, ...doc.data() });
      });

      // Sort by score desc, then by X-count (tiebreaker), then by faster total time
      documents.sort((a, b) => {
        if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
        const ax = a.tiebreakerData?.xCount || 0;
        const bx = b.tiebreakerData?.xCount || 0;
        if (bx !== ax) return bx - ax;
        return (a.tiebreakerData?.totalTime || 0) - (b.tiebreakerData?.totalTime || 0);
      });

      return documents;
    } catch (error) {
      console.error('Error getting competition scores:', error);
      return [];
    }
  }

  async getScoresByUser(userId) {
    try {
      // Simple query without complex ordering to avoid index issues
      const snapshot = await this.db.collection('scores')
        .where('competitorId', '==', userId)
        .get();

      const toMillis = (ts) => {
        if (!ts) return 0;
        // Firestore Timestamp from admin SDK
        if (typeof ts === 'object' && typeof ts.toMillis === 'function') return ts.toMillis();
        // Timestamp-like objects
        if (typeof ts === 'object' && typeof ts.seconds === 'number') return ts.seconds * 1000;
        const n = Date.parse(ts);
        return Number.isNaN(n) ? 0 : n;
      };

      const toISO = (ts) => {
        const ms = toMillis(ts);
        return ms ? new Date(ms).toISOString() : null;
      };

      const documents = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        // Normalize createdAt to ISO for clients to avoid Invalid Date on UI
        const createdAtISO = toISO(data.createdAt) || toISO(data.submittedAt) || new Date().toISOString();
        const updatedAtISO = toISO(data.updatedAt) || null;
        documents.push({ id: doc.id, ...data, createdAt: createdAtISO, ...(updatedAtISO && { updatedAt: updatedAtISO }) });
      });

      // Sort in memory by createdAt desc
      return documents.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    } catch (error) {
      console.error('Error getting user scores:', error);
      return []; // Return empty array instead of throwing
    }
  }

  async getPendingVerificationScores() {
    try {
      // Fetch all scores and filter in memory to avoid index requirements
      const snapshot = await this.db.collection('scores').get();
      const documents = [];
      snapshot.forEach(doc => {
        documents.push({ id: doc.id, ...doc.data() });
      });

      // Treat missing status as pending for legacy data; include flagged
      const needsReview = documents.filter(s => {
        const status = s.verificationStatus;
        return status === 'pending' || status === 'flagged' || status == null;
      });

      const toMillis = (ts) => {
        if (!ts) return 0;
        if (typeof ts === 'object' && typeof ts.toMillis === 'function') return ts.toMillis();
        if (typeof ts === 'object' && typeof ts.seconds === 'number') return ts.seconds * 1000;
        const n = Date.parse(ts);
        return Number.isNaN(n) ? 0 : n;
      };

      return needsReview.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
    } catch (error) {
      console.error('Error getting pending verification scores:', error);
      return []; // Return empty array instead of throwing
    }
  }

  // Leaderboard operations
  async getLeaderboard(type = 'overall', limit = 50) {
    try {
      // Get all scores and filter in memory to avoid index issues
      const scoresSnapshot = await this.db.collection('scores').get();
      let scores = [];
      
      scoresSnapshot.forEach(doc => {
        const scoreData = doc.data();
        scores.push({
          id: doc.id,
          ...scoreData
        });
      });

      // Only include approved scores for public leaderboards; treat missing status as approved (backwards compat)
      scores = scores.filter(s => (s.verificationStatus ?? 'approved') === 'approved');

      // Filter by type if needed
      if (type === 'indoor' || type === 'outdoor') {
        // Get competitions to check their type
        const competitionsSnapshot = await this.db.collection('competitions').get();
        const competitions = {};
        competitionsSnapshot.forEach(doc => {
          competitions[doc.id] = doc.data();
        });

        scores = scores.filter(score => {
          const competition = competitions[score.competitionId];
          if (!competition) return false;
          
          const competitionType = competition.competitionType || competition.type;
          return competitionType === type;
        });
      }

      // Deduplicate by competitor and keep only their best score
      const uniqueScores = [];
      const competitorMap = new Map();
      
      scores.forEach(score => {
        const existing = competitorMap.get(score.competitorId);
        if (!existing) {
          competitorMap.set(score.competitorId, score);
          return;
        }
        if (score.score > existing.score) {
          competitorMap.set(score.competitorId, score);
          return;
        }
        if (score.score === existing.score) {
          const sx = score.tiebreakerData?.xCount || 0;
          const ex = existing.tiebreakerData?.xCount || 0;
          if (sx > ex) {
            competitorMap.set(score.competitorId, score);
            return;
          }
          // As an additional subtle tiebreaker, prefer faster total time
          const st = score.tiebreakerData?.totalTime || 0;
          const et = existing.tiebreakerData?.totalTime || 0;
          if (st < et) {
            competitorMap.set(score.competitorId, score);
          }
        }
      });
      
      // Convert back to array and sort by score, then X count, then faster time
      const deduplicatedScores = Array.from(competitorMap.values());
      deduplicatedScores.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const ax = a.tiebreakerData?.xCount || 0;
        const bx = b.tiebreakerData?.xCount || 0;
        if (bx !== ax) return bx - ax;
        return (a.tiebreakerData?.totalTime || 0) - (b.tiebreakerData?.totalTime || 0);
      });
      
      // Apply limit
      const limitedScores = deduplicatedScores.slice(0, limit);

      return limitedScores;
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      return [];
    }
  }

  // Admin operations
  async getUnverifiedUsers() {
    return this.find('users', { isVerified: false });
  }

  async getSystemStats() {
    try {
      const [users, competitions, scores] = await Promise.all([
        this.db.collection('users').get(),
        this.db.collection('competitions').get(),
        this.db.collection('scores').get()
      ]);

      // Get recent activity (last 10 items)
      const recentScores = await this.db.collection('scores')
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();

      const recentActivity = [];
      
      // Add recent score submissions
      recentScores.forEach(doc => {
        const score = doc.data();
        recentActivity.push({
          type: 'score',
          message: `New score submitted: ${score.totalScore} points`,
          timestamp: score.createdAt
        });
      });

      // Add some mock activity for now
      recentActivity.push(
        {
          type: 'user',
          message: 'New user registered',
          timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString() // 30 minutes ago
        },
        {
          type: 'competition',
          message: 'New competition created',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() // 2 hours ago
        }
      );

      // Sort by timestamp
      recentActivity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Get competition status counts
      const competitionDocs = competitions.docs;
      const publishedCompetitions = competitionDocs.filter(doc => doc.data().status === 'published').length;
      const draftCompetitions = competitionDocs.filter(doc => doc.data().status === 'draft').length;
      const completedCompetitions = competitionDocs.filter(doc => doc.data().status === 'completed').length;
      const cancelledCompetitions = competitionDocs.filter(doc => doc.data().status === 'cancelled').length;
      const activeCompetitions = publishedCompetitions;

      return {
        totalUsers: users.size,
        totalCompetitions: competitions.size,
        totalScores: scores.size,
        unverifiedUsers: 0, // Simplified to avoid index issues
        pendingScores: 0,   // Simplified to avoid index issues
        recentActivity: recentActivity.slice(0, 10), // Limit to 10 items
        
        // Additional stats for dashboard
        newUsersThisPeriod: Math.floor(users.size * 0.1), // Mock data
        activeCompetitions,
        publishedCompetitions,
        draftCompetitions,
        completedCompetitions,
        cancelledCompetitions,
        totalRevenue: 0, // Mock data
        revenueThisPeriod: 0, // Mock data
        activeSessions: Math.floor(users.size * 0.3), // Mock data
        failedLogins: 0, // Mock data
        suspiciousActivity: 0 // Mock data
      };
    } catch (error) {
      console.error('Error getting system stats:', error);
      return {
        totalUsers: 0,
        totalCompetitions: 0,
        totalScores: 0,
        unverifiedUsers: 0,
        pendingScores: 0,
        recentActivity: [],
        
        // Additional stats for dashboard
        newUsersThisPeriod: 0,
        activeCompetitions: 0,
        publishedCompetitions: 0,
        draftCompetitions: 0,
        completedCompetitions: 0,
        cancelledCompetitions: 0,
        totalRevenue: 0,
        revenueThisPeriod: 0,
        activeSessions: 0,
        failedLogins: 0,
        suspiciousActivity: 0
      };
    }
  }
}

module.exports = new FirebaseService();
