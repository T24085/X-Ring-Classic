// Firebase-backed API layer to replace server endpoints for GitHub Pages
// NOTE: Implements core read/write paths; admin/reporting endpoints are minimal.

import { auth, db } from './firebaseClient';
import { classificationFromAvg } from './classification';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updatePassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';

// Helpers
const toUserShape = (uid, data) => ({ id: uid, ...data });

// Auth API
export const authAPI = {
  login: async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
    const profile = userDoc.exists() ? userDoc.data() : { email: cred.user.email };
    return { data: { user: toUserShape(cred.user.uid, profile), token: await cred.user.getIdToken() } };
  },
  register: async (userData) => {
    const { email, password, username, firstName, lastName } = userData;
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const profile = {
      email,
      username: username || email.split('@')[0],
      firstName: firstName || '',
      lastName: lastName || '',
      role: 'user',
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'users', cred.user.uid), profile, { merge: true });
    return { data: { user: toUserShape(cred.user.uid, profile), token: await cred.user.getIdToken() } };
  },
  getCurrentUser: async () => {
    const u = auth.currentUser;
    if (!u) throw new Error('Not authenticated');
    const snap = await getDoc(doc(db, 'users', u.uid));
    const profile = snap.exists() ? snap.data() : { email: u.email };
    return { data: { user: toUserShape(u.uid, profile) } };
  },
  changePassword: async (currentPassword, newPassword) => {
    // Firebase requires re-auth; skip here and just call update if session is fresh
    if (!auth.currentUser) throw new Error('Not authenticated');
    await updatePassword(auth.currentUser, newPassword);
    return { data: { message: 'Password updated' } };
  },
  forgotPassword: async (email) => {
    await sendPasswordResetEmail(auth, email);
    return { data: { message: 'Reset email sent' } };
  },
  setAuthToken: () => {},
  removeAuthToken: () => {},
};

// Competitions API
export const competitionsAPI = {
  getAll: async (params = {}) => {
    const col = collection(db, 'competitions');
    const filters = [];
    // Firestore rules require reads of competitions to match status == 'published' for public
    // If no explicit filter is provided (or 'all' is requested), default to published
    if (params?.status && params.status !== 'all') {
      filters.push(where('status', '==', params.status));
    } else {
      filters.push(where('status', '==', 'published'));
    }
    if (params?.format && params.format !== 'all') filters.push(where('format', '==', params.format));
    if (params?.type && params.type !== 'all') filters.push(where('type', '==', params.type));
    const q = filters.length ? query(col, ...filters) : col;
    const snap = await getDocs(q);
    let competitions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Hydrate participant counts from registrations for all competitions
    // Firestore 'in' operator has a limit of 10, so we batch queries
    const compIds = competitions.map(c => c.id);
    const regCounts = new Map();
    
    if (compIds.length > 0) {
      // Batch queries in groups of 10
      const batchSize = 10;
      for (let i = 0; i < compIds.length; i += batchSize) {
        const batch = compIds.slice(i, i + batchSize);
        const batchRegsSnap = await getDocs(query(collection(db, 'registrations'), where('competitionId', 'in', batch)));
        const batchRegs = batchRegsSnap.docs.map(d => d.data());
        batchRegs.forEach(reg => {
          if (reg.competitionId) {
            const count = regCounts.get(reg.competitionId) || 0;
            regCounts.set(reg.competitionId, count + 1);
          }
        });
      }
      
      // Update competitions with actual participant counts
      competitions = competitions.map(comp => {
        const actualCount = regCounts.get(comp.id) || 0;
        return {
          ...comp,
          participantCount: actualCount,
          registeredCount: actualCount,
        };
      });
    }
    
    // Basic client-side date filtering and sorting
    const { dateFrom, dateTo } = params || {};
    if (dateFrom || dateTo) {
      competitions = competitions.filter(c => {
        const compDate = new Date(c?.schedule?.competitionDate || c?.competitionDate || 0);
        if (dateFrom && compDate < new Date(dateFrom)) return false;
        if (dateTo && compDate > new Date(dateTo)) return false;
        return true;
      });
    }
    competitions.sort((a, b) => new Date(a?.schedule?.competitionDate || 0) - new Date(b?.schedule?.competitionDate || 0));
    const lim = Number(params?.limit || 0);
    const sliced = lim > 0 ? competitions.slice(0, lim) : competitions;
    return { data: { competitions: sliced, pagination: { current: 1, total: 1, hasNext: false, hasPrev: false } } };
  },
  getByRange: async (rangeId) => {
    if (!rangeId) return { data: { competitions: [] } };
    
    const col = collection(db, 'competitions');
    const snap = await getDocs(col);
    let competitions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Filter by range - check range.id, range.name, or rangeId field
    competitions = competitions.filter(c => 
      c.range?.id === rangeId || 
      c.range?.name === rangeId || 
      c.rangeId === rangeId ||
      (typeof rangeId === 'string' && c.range?.name?.toLowerCase() === rangeId.toLowerCase())
    );
    
    // Sort by date
    competitions.sort((a, b) => {
      const dateA = new Date(a?.schedule?.competitionDate || a?.competitionDate || 0);
      const dateB = new Date(b?.schedule?.competitionDate || b?.competitionDate || 0);
      return dateB - dateA; // Newest first
    });
    
    return { data: { competitions } };
  },
  getById: async (id) => {
    const compSnap = await getDoc(doc(db, 'competitions', id));
    if (!compSnap.exists()) throw new Error('Competition not found');

    // Hydrate participants from registrations collection
    const regsSnap = await getDocs(query(collection(db, 'registrations'), where('competitionId', '==', id)));
    const regs = regsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const userIds = Array.from(new Set(regs.map(r => r.userId).filter(Boolean)));
    // Use Promise.allSettled to handle permission errors gracefully (admin/range_admin users may not be readable)
    const userResults = await Promise.allSettled(userIds.map(uid => getDoc(doc(db, 'users', uid))));
    const userMap = new Map();
    userResults.forEach((res, i) => {
      const uid = userIds[i];
      if (res.status === 'fulfilled') {
        const snap = res.value;
        userMap.set(uid, snap.exists() ? { id: uid, ...snap.data() } : null);
      } else {
        // Permission denied or other error - set to null, will use fallback name
        userMap.set(uid, null);
      }
    });
    const participants = regs.map(r => {
      const u = userMap.get(r.userId);
      const name = u ? (u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : (u.username || u.email || 'User')) : 'User';
      return {
        userId: r.userId,
        userName: name,
        location: u?.location || '',
        registeredAt: r.registeredAt || r.createdAt || new Date().toISOString(),
      };
    });

    const comp = { id: compSnap.id, ...compSnap.data() };
    comp.participants = participants;
    comp.participantCount = participants.length;
    comp.registeredCount = participants.length;
    return { data: { competition: comp } };
  },
  create: async (competitionData) => {
    const ref = await addDoc(collection(db, 'competitions'), {
      ...competitionData,
      createdAt: serverTimestamp(),
      organizerId: auth.currentUser?.uid || null,
      status: competitionData?.status || 'draft',
    });
    const snap = await getDoc(ref);
    return { data: { competition: { id: ref.id, ...snap.data() } } };
  },
  update: async (id, competitionData) => {
    await updateDoc(doc(db, 'competitions', id), { ...competitionData, updatedAt: serverTimestamp() });
    const snap = await getDoc(doc(db, 'competitions', id));
    return { data: { competition: { id, ...snap.data() } } };
  },
  delete: async (id) => {
    // Soft-delete or require Cloud Functions for actual delete; here we mark as archived
    await updateDoc(doc(db, 'competitions', id), { status: 'archived', archivedAt: serverTimestamp() });
    return { data: { message: 'Competition archived' } };
  },
  publish: async (id) => {
    await updateDoc(doc(db, 'competitions', id), { status: 'published', publishedAt: serverTimestamp() });
    return { data: { message: 'Competition published' } };
  },
  register: async (id) => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');
    const competitionSnap = await getDoc(doc(db, 'competitions', id));
    if (!competitionSnap.exists()) throw new Error('Competition not found');
    const competition = { id: competitionSnap.id, ...competitionSnap.data() };
    if (!['published', 'active'].includes(competition.status)) throw new Error('Registration closed');

    // Check existing registration
    const regsSnap = await getDocs(query(collection(db, 'registrations'), where('userId', '==', uid), where('competitionId', '==', id)));
    if (!regsSnap.empty) throw new Error('Already registered');

    // Create registration (counts are calculated dynamically from registrations collection)
    await addDoc(collection(db, 'registrations'), {
      competitionId: id,
      userId: uid,
      status: 'registered',
      registeredAt: new Date().toISOString(),
    });

    return { data: { message: 'Successfully registered for competition' } };
  },
};

// Scores API (minimal)
export const scoresAPI = {
  submit: async (scoreData) => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');
    const shots = Array.isArray(scoreData?.shots) ? scoreData.shots : [];
    const xCount = shots.filter(s => (s?.isX === true) || (Number(s?.value) === 10 && s?.isX)).length;
    const payload = {
      ...scoreData,
      competitorId: uid,
      createdAt: serverTimestamp(),
      verificationStatus: 'pending',
      tiebreakerData: {
        ...(scoreData?.tiebreakerData || {}),
        xCount,
        perfectShots: xCount,
      },
    };
    const ref = await addDoc(collection(db, 'scores'), payload);
    const snap = await getDoc(ref);
    return { data: { score: { id: ref.id, ...snap.data() } } };
  },
  submitOnBehalf: async (scoreData) => {
    // For client-only: same as submit but accept competitorId in payload
    const uid = scoreData?.competitorId || auth.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');
    const shots = Array.isArray(scoreData?.shots) ? scoreData.shots : [];
    const xCount = shots.filter(s => (s?.isX === true) || (Number(s?.value) === 10 && s?.isX)).length;
    const payload = {
      ...scoreData,
      competitorId: uid,
      createdAt: serverTimestamp(),
      verificationStatus: 'pending',
      tiebreakerData: {
        ...(scoreData?.tiebreakerData || {}),
        xCount,
        perfectShots: xCount,
      },
    };
    const ref = await addDoc(collection(db, 'scores'), payload);
    const snap = await getDoc(ref);
    return { data: { score: { id: ref.id, ...snap.data() } } };
  },
  getByCompetition: async (competitionId) => {
    const snap = await getDocs(query(
      collection(db, 'scores'),
      where('competitionId', '==', competitionId),
      where('verificationStatus', '==', 'approved')
    ));
    const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const ids = Array.from(new Set(raw.map(s => s.competitorId).filter(Boolean)));
    const userResults = await Promise.allSettled(ids.map(uid => getDoc(doc(db, 'users', uid))));
    const userMap = new Map();
    userResults.forEach((res, i) => {
      const uid = ids[i];
      if (res.status === 'fulfilled') {
        const snap = res.value;
        userMap.set(uid, snap.exists() ? { id: uid, ...snap.data() } : null);
      } else {
        userMap.set(uid, null);
      }
    });
    const scores = raw.map(s => ({
      ...s,
      competitor: userMap.get(s.competitorId) || null,
      submittedAt: (() => {
        const d = s.createdAt || s.updatedAt || s.submittedAt;
        try {
          if (typeof d?.toMillis === 'function') return new Date(d.toMillis()).toISOString();
          if (typeof d?.toDate === 'function') return d.toDate().toISOString();
          if (typeof d?.seconds === 'number') return new Date(d.seconds * 1000).toISOString();
          const t = Date.parse(d);
          return Number.isFinite(t) ? new Date(t).toISOString() : new Date().toISOString();
        } catch { return new Date().toISOString(); }
      })(),
    }));
    return { data: { scores } };
  },
  verify: async (scoreId, status, notes) => {
    await updateDoc(doc(db, 'scores', scoreId), {
      verificationStatus: status,
      verificationNotes: notes || '',
      verifiedAt: serverTimestamp(),
    });
    return { data: { message: `Score ${status}` } };
  },
  flag: async (scoreId, reason) => {
    await updateDoc(doc(db, 'scores', scoreId), {
      verificationStatus: 'flagged',
      flagReason: reason,
      flaggedAt: serverTimestamp(),
    });
    return { data: { message: 'Score flagged' } };
  },
  getPendingVerification: async () => {
    const snap = await getDocs(query(collection(db, 'scores'), where('verificationStatus', '==', 'pending')));
    const scores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return { scores };
  },
};

// Leaderboards API (basic overall)
export const leaderboardsAPI = {
  getOverall: async (params = {}) => {
    try {
      // Firestore requires composite indexes for complex order/filters; keep simple
      const lim = Number(params?.limit || 10);
      const category = params?.category; // Filter by category if provided (22LR or Airgun 22cal)
      
      // Build query with category filter if provided
      let q;
      if (category) {
        q = query(
          collection(db, 'scores'),
          where('verificationStatus', '==', 'approved'),
          where('category', '==', category)
        );
      } else {
        q = query(
          collection(db, 'scores'),
          where('verificationStatus', '==', 'approved')
        );
      }
      
      const snap = await getDocs(q);
      let scores = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(s => s.verificationStatus === 'approved' || !s.verificationStatus)
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, lim);

      console.log(`[Leaderboard] Found ${scores.length} approved scores`);

      // Populate competitor profiles - show all scores for all authenticated users
      const ids = Array.from(new Set(scores.map(s => s.competitorId).filter(Boolean)));
      // Tolerate permission-denied on user docs; fall back to basic info
      const userResults = await Promise.allSettled(ids.map(uid => getDoc(doc(db, 'users', uid))));
      const userMap = new Map();
      
      userResults.forEach((res, i) => {
        const uid = ids[i];
        if (res.status === 'fulfilled') {
          const snap = res.value;
          if (snap.exists()) {
            const userData = snap.data();
            userMap.set(uid, { 
              id: uid, 
              ...userData,
              // Ensure we have username, firstName, lastName even if empty
              username: userData.username || userData.email?.split('@')[0] || 'user',
              firstName: userData.firstName || '',
              lastName: userData.lastName || '',
            });
          } else {
            console.warn(`User document ${uid} does not exist`);
            userMap.set(uid, null);
          }
        } else {
          // Permission denied - use fallback data
          const error = res.reason;
          if (error?.code === 'permission-denied') {
            console.warn(`Permission denied for user ${uid} - using fallback data`);
          } else {
            console.error(`Failed to fetch user ${uid}:`, error);
          }
          userMap.set(uid, null);
        }
      });

      // Show all scores - no filtering for authenticated users
      const leaderboard = scores.map((s, idx) => {
      const u = userMap.get(s.competitorId);
      // If user data exists, use it; otherwise fall back to score data or defaults
      const competitor = u ? u : { 
        id: s.competitorId, 
        username: s.username || s.competitor?.username || 'user', 
        firstName: s.competitor?.firstName || s.firstName || 'Shooter', 
        lastName: s.competitor?.lastName || s.lastName || '',
        email: s.competitor?.email || s.email || '',
      };
      const avg = s.averageScore || s.score || 0;
      const computedX = (Array.isArray(s.shots) ? s.shots.filter(sh => (Number(sh?.value) === 10 && (sh?.isX === true))).length : 0);
      const xCount = (typeof s.tiebreakerData?.xCount === 'number') ? s.tiebreakerData.xCount : computedX;
      const xAvg = xCount; // for single-score rows; multi-score averaging not implemented here
      const cls = competitor.classification || classificationFromAvg(avg, xAvg) || undefined;
      if (cls) competitor.classification = cls;
      return {
        rank: idx + 1,
        competitor,
        score: s.score || 0,
        bestScore: s.bestScore || s.score || 0,
        averageScore: s.averageScore || s.score || 0,
        competitionsCount: s.competitionsCount || 1,
        tiebreakerData: { xCount },
      };
      });
      
      console.log(`[Leaderboard] Returning ${leaderboard.length} leaderboard entries`);
      return { data: { leaderboard } };
    } catch (error) {
      console.error('[Leaderboard] Error in getOverall:', error);
      throw error;
    }
  },
  getIndoor: async (params = {}) => leaderboardsAPI.getOverall(params),
  getOutdoor: async (params = {}) => leaderboardsAPI.getOverall(params),
  getByCompetition: async (competitionId, params = {}) => {
    // Match rules by requiring approved scores for public leaderboards
    const category = params?.category; // Filter by category if provided
    
    let q;
    if (category) {
      q = query(
        collection(db, 'scores'),
        where('competitionId', '==', competitionId),
        where('verificationStatus', '==', 'approved'),
        where('category', '==', category)
      );
    } else {
      q = query(
        collection(db, 'scores'),
        where('competitionId', '==', competitionId),
        where('verificationStatus', '==', 'approved')
      );
    }
    
    const snap = await getDocs(q);
    let scores = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(s => s.verificationStatus === 'approved' || !s.verificationStatus)
      .sort((a, b) => (b.score || 0) - (a.score || 0));

    // Populate competitor profiles - show all scores for all authenticated users
    const ids = Array.from(new Set(scores.map(s => s.competitorId).filter(Boolean)));
    const userResults = await Promise.allSettled(ids.map(uid => getDoc(doc(db, 'users', uid))));
    const userMap = new Map();
    
    userResults.forEach((res, i) => {
      const uid = ids[i];
      if (res.status === 'fulfilled') {
        const snap = res.value;
        if (snap.exists()) {
          const userData = snap.data();
          userMap.set(uid, { 
            id: uid, 
            ...userData,
            // Ensure we have username, firstName, lastName even if empty
            username: userData.username || userData.email?.split('@')[0] || 'user',
            firstName: userData.firstName || '',
            lastName: userData.lastName || '',
          });
        } else {
          console.warn(`User document ${uid} does not exist`);
          userMap.set(uid, null);
        }
      } else {
        // Permission denied - use fallback data
        const error = res.reason;
        if (error?.code === 'permission-denied') {
          console.warn(`Permission denied for user ${uid} - using fallback data`);
        } else {
          console.error(`Failed to fetch user ${uid}:`, error);
        }
        userMap.set(uid, null);
      }
    });

    // Show all scores - no filtering for authenticated users
    const leaderboard = scores.map((s, idx) => {
      const u = userMap.get(s.competitorId);
      // If user data exists, use it; otherwise fall back to score data or defaults
      const competitor = u ? u : { 
        id: s.competitorId, 
        username: s.username || s.competitor?.username || 'user', 
        firstName: s.competitor?.firstName || s.firstName || 'Shooter', 
        lastName: s.competitor?.lastName || s.lastName || '',
        email: s.competitor?.email || s.email || '',
      };
      const avg = s.averageScore || s.score || 0;
      const xAvg = s.tiebreakerData?.xCount || 0;
      const cls = competitor.classification || classificationFromAvg(avg, xAvg) || undefined;
      if (cls) competitor.classification = cls;
      return {
        rank: idx + 1,
        competitor,
        score: s.score || 0,
        bestScore: s.bestScore || s.score || 0,
        averageScore: s.averageScore || s.score || 0,
        competitionsCount: s.competitionsCount || 1,
      };
    });
    return { data: { leaderboard } };
  },
  getByFormat: async (_format, params = {}) => leaderboardsAPI.getOverall(params),
};

// Public API
export const publicAPI = {
  getStats: async () => {
    const [comps, scores] = await Promise.all([
      getDocs(query(collection(db, 'competitions'), where('status', '==', 'published'))),
      getDocs(query(collection(db, 'scores'), where('verificationStatus', '==', 'approved'))),
    ]);
    // Map to keys expected by Home page
    const activeCompetitions = comps.docs.filter(d => (d.data()?.status || '') === 'published').length;
    return {
      activeCompetitions,
      totalUsers: 0,
      totalScores: scores.size,
      rangesPartnered: 0,
    };
  },
};

// Users API (subset)
export const usersAPI = {
  getProfile: async (userId) => {
    const snap = await getDoc(doc(db, 'users', userId));
    return { data: { user: snap.exists() ? { id: snap.id, ...snap.data() } : null } };
  },
  updateProfile: async (profileData) => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');
    await setDoc(doc(db, 'users', uid), { ...profileData, updatedAt: serverTimestamp() }, { merge: true });
    return { data: { message: 'Profile updated' } };
  },
  getScores: async (userId, _params) => {
    const snap = await getDocs(query(collection(db, 'scores'), where('competitorId', '==', userId)));
    const scores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return { data: { scores } };
  },
  getCompetitions: async (userId, _params) => {
    const regs = await getDocs(query(collection(db, 'registrations'), where('userId', '==', userId)));
    const compIds = regs.docs.map(d => d.data().competitionId);
    const comps = await Promise.all(compIds.map(async (id) => {
      const s = await getDoc(doc(db, 'competitions', id));
      return s.exists() ? { id: s.id, ...s.data() } : null;
    }));
    return { data: { competitions: comps.filter(Boolean) } };
  },
  search: async () => ({ data: { users: [] } }),
  getTopShooters: async () => ({ data: { users: [] } }),
  verify: async (userId) => {
    const actor = auth.currentUser;
    if (!actor) throw new Error('Not authenticated');
    const actorSnap = await getDoc(doc(db, 'users', actor.uid));
    const actorRole = actorSnap.exists() ? actorSnap.data()?.role : undefined;
    if (actorRole !== 'admin') throw new Error('Admin only');
    await updateDoc(doc(db, 'users', userId), {
      isVerified: true,
      verificationStatus: 'verified',
      updatedAt: serverTimestamp(),
    });
    return { data: { message: 'User verified' } };
  },
  deactivate: async (userId) => {
    const actor = auth.currentUser;
    if (!actor) throw new Error('Not authenticated');
    const actorSnap = await getDoc(doc(db, 'users', actor.uid));
    const actorRole = actorSnap.exists() ? actorSnap.data()?.role : undefined;
    if (actorRole !== 'admin') throw new Error('Admin only');
    await updateDoc(doc(db, 'users', userId), {
      isActive: false,
      updatedAt: serverTimestamp(),
    });
    return { data: { message: 'User deactivated' } };
  },
  updateRole: async (userId, role, rangeId = null) => {
    const actor = auth.currentUser;
    if (!actor) throw new Error('Not authenticated');
    const actorSnap = await getDoc(doc(db, 'users', actor.uid));
    const actorRole = actorSnap.exists() ? actorSnap.data()?.role : undefined;
    if (actorRole !== 'admin') throw new Error('Admin only');
    const allowed = ['competitor', 'range_officer', 'range_admin', 'admin'];
    if (!allowed.includes(role)) throw new Error('Invalid role');
    
    const updateData = { role, updatedAt: serverTimestamp() };
    
    // If setting as range_admin and rangeId provided, update range assignment
    if (role === 'range_admin' && rangeId) {
      const rangeSnap = await getDoc(doc(db, 'ranges', rangeId));
      if (rangeSnap.exists()) {
        const rangeData = rangeSnap.data();
        updateData.rangeId = rangeId;
        updateData.rangeName = rangeData.name || '';
        updateData.rangeLocation = rangeData.location || '';
      }
    }
    
    await updateDoc(doc(db, 'users', userId), updateData);
    return { data: { message: 'Role updated' } };
  },
  updateUserRange: async (userId, rangeId) => {
    const actor = auth.currentUser;
    if (!actor) throw new Error('Not authenticated');
    const actorSnap = await getDoc(doc(db, 'users', actor.uid));
    const actorRole = actorSnap.exists() ? actorSnap.data()?.role : undefined;
    if (actorRole !== 'admin') throw new Error('Admin only');
    
    if (!rangeId) {
      // Remove range assignment
      await updateDoc(doc(db, 'users', userId), {
        rangeId: null,
        rangeName: null,
        rangeLocation: null,
        updatedAt: serverTimestamp(),
      });
      return { data: { message: 'Range assignment removed' } };
    }
    
    const rangeSnap = await getDoc(doc(db, 'ranges', rangeId));
    if (!rangeSnap.exists()) throw new Error('Range not found');
    const rangeData = rangeSnap.data();
    
    await updateDoc(doc(db, 'users', userId), {
      rangeId,
      rangeName: rangeData.name || '',
      rangeLocation: rangeData.location || '',
      updatedAt: serverTimestamp(),
    });
    return { data: { message: 'Range assignment updated' } };
  },
  delete: async (userId) => {
    const actor = auth.currentUser;
    if (!actor) throw new Error('Not authenticated');
    const actorSnap = await getDoc(doc(db, 'users', actor.uid));
    const actorRole = actorSnap.exists() ? actorSnap.data()?.role : undefined;
    if (actorRole !== 'admin') throw new Error('Admin only');
    // Best-effort cleanup of user-related docs
    const scoreSnaps = await getDocs(query(collection(db, 'scores'), where('competitorId', '==', userId)));
    for (const s of scoreSnaps.docs) {
      await deleteDoc(doc(db, 'scores', s.id));
    }
    const regSnaps = await getDocs(query(collection(db, 'registrations'), where('userId', '==', userId)));
    for (const r of regSnaps.docs) {
      await deleteDoc(doc(db, 'registrations', r.id));
    }
    await deleteDoc(doc(db, 'users', userId));
    return { data: { message: 'User and related data removed' } };
  },
};

// Admin API (stubs/minimal)
export const adminAPI = {
  getDashboard: async (params = {}) => {
    const period = params.period || '30-days';
    
    // Calculate date range based on period
    const now = new Date();
    let startDate = new Date();
    switch (period) {
      case '7-days':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30-days':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90-days':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1-year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Get all users and competitions
    const [usersSnap, competitionsSnap, scoresSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'competitions')),
      getDocs(collection(db, 'scores')),
    ]);

    const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const competitions = competitionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const scores = scoresSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Helper to convert Firestore timestamp to Date
    const toDate = (ts) => {
      if (!ts) return null;
      if (ts.toMillis) return new Date(ts.toMillis());
      if (ts.toDate) return ts.toDate();
      if (typeof ts === 'string') return new Date(ts);
      if (typeof ts === 'number') return new Date(ts);
      return null;
    };

    // Calculate user growth data points
    const userGrowthData = [];
    const daysDiff = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));
    const interval = daysDiff <= 7 ? 1 : daysDiff <= 30 ? 7 : daysDiff <= 90 ? 14 : 30; // days per data point
    
    for (let i = 0; i <= daysDiff; i += interval) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      const usersBeforeDate = users.filter(u => {
        const created = toDate(u.createdAt);
        return created && created <= date;
      }).length;
      
      userGrowthData.push({
        date: dateStr,
        users: usersBeforeDate,
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      });
    }

    // Calculate competition activity data points
    const competitionActivityData = [];
    const statusCounts = {
      published: 0,
      draft: 0,
      completed: 0,
      cancelled: 0,
    };

    competitions.forEach(comp => {
      const status = comp.status || 'draft';
      if (statusCounts.hasOwnProperty(status)) {
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      }
    });

    // Competition activity over time (by creation date)
    for (let i = 0; i <= daysDiff; i += interval) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      const compsBeforeDate = competitions.filter(c => {
        const created = toDate(c.createdAt);
        return created && created <= date;
      }).length;
      
      const activeComps = competitions.filter(c => {
        const created = toDate(c.createdAt);
        const status = c.status || 'draft';
        return created && created <= date && status === 'published';
      }).length;
      
      competitionActivityData.push({
        date: dateStr,
        total: compsBeforeDate,
        active: activeComps,
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      });
    }

    // Calculate stats
    const newUsersThisPeriod = users.filter(u => {
      const created = toDate(u.createdAt);
      return created && created >= startDate;
    }).length;

    const pendingScores = scores.filter(s => (s.verificationStatus || 'approved') === 'pending').length;

    // Calculate revenue: $10 per approved score
    // Each score represents a paid entry fee, confirmed when approved
    const ENTRY_FEE_PER_SCORE = 10;
    
    // Total revenue: all approved scores
    // Only count scores that are explicitly approved (verificationStatus === 'approved')
    const approvedScores = scores.filter(s => s.verificationStatus === 'approved');
    const totalRevenue = approvedScores.length * ENTRY_FEE_PER_SCORE;
    
    // Revenue this period: approved scores verified (or submitted) within the period
    const revenueThisPeriodScores = approvedScores.filter(s => {
      // Prefer verifiedAt date (when it was approved), fallback to createdAt (when submitted)
      const dateToCheck = toDate(s.verifiedAt) || toDate(s.createdAt) || toDate(s.submittedAt);
      return dateToCheck && dateToCheck >= startDate;
    });
    const revenueThisPeriod = revenueThisPeriodScores.length * ENTRY_FEE_PER_SCORE;

    const totals = await publicAPI.getStats();
    
    return {
      stats: {
        totalUsers: totals.totalUsers || 0,
        newUsersThisPeriod,
        activeCompetitions: totals.activeCompetitions || 0,
        totalCompetitions: competitions.length || 0,
        publishedCompetitions: statusCounts.published || 0,
        draftCompetitions: statusCounts.draft || 0,
        completedCompetitions: statusCounts.completed || 0,
        cancelledCompetitions: statusCounts.cancelled || 0,
        totalScores: totals.totalScores || 0,
        pendingScores,
        totalRevenue,
        revenueThisPeriod,
        activeSessions: 0,
        failedLogins: 0,
        suspiciousActivity: 0,
      },
      userGrowthData,
      competitionActivityData,
      recentActivity: [],
    };
  },
  getUsers: async (params = {}) => {
    const snap = await getDocs(collection(db, 'users'));
    let users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const { role, search, page = 1, limit = 20 } = params || {};
    if (role) users = users.filter(u => (u.role || 'competitor') === role);
    if (search) {
      const q = String(search).toLowerCase();
      users = users.filter(u =>
        (u.username || '').toLowerCase().includes(q) ||
        (u.firstName || '').toLowerCase().includes(q) ||
        (u.lastName || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      );
    }
    // Sort newest first if createdAt present
    users.sort((a, b) => {
      const ad = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
      const bd = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
      return bd - ad;
    });
    const totalUsers = users.length;
    const start = (Number(page) - 1) * Number(limit);
    const paged = users.slice(start, start + Number(limit));
    const totalPages = Math.max(1, Math.ceil(totalUsers / Number(limit)));
    return {
      users: paged,
      pagination: {
        current: Number(page),
        total: totalPages,
        hasPrev: Number(page) > 1,
        hasNext: Number(page) < totalPages,
        totalUsers,
      },
    };
  },
  getCompetitions: async (params) => competitionsAPI.getAll(params),
  getScores: async (params = {}) => {
    const snap = await getDocs(collection(db, 'scores'));
    let scores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (params?.verificationStatus) {
      scores = scores.filter(s => (s.verificationStatus || 'approved') === params.verificationStatus);
    }
    return { scores };
  },
  updateCompetitionStatus: async (competitionId, status) => competitionsAPI.update(competitionId, { status }).then(r => r.data),
  deleteScore: async (scoreId) => {
    await updateDoc(doc(db, 'scores', scoreId), { deleted: true, deletedAt: serverTimestamp() });
    return { data: { message: 'Score marked deleted' } };
  },
  getReports: async () => ({ data: {} }),
  getRangeAdmins: async () => {
    const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'range_admin')));
    const rangeAdmins = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return { data: { rangeAdmins } };
  },
  getRangeDashboard: async (rangeId, period = '30-days') => {
    // Admin can view any range dashboard
    return rangeAdminAPI.getDashboard({ rangeId, period });
  },
  createRangeAdmin: async (data) => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');
    
    // Find the range by name or ID to get the rangeId
    let rangeId = data.rangeId;
    if (!rangeId && data.rangeName) {
      const rangesSnap = await getDocs(collection(db, 'ranges'));
      const ranges = rangesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const matchingRange = ranges.find(r => 
        r.name === data.rangeName || 
        r.name?.toLowerCase() === data.rangeName?.toLowerCase()
      );
      if (matchingRange) {
        rangeId = matchingRange.id;
      }
    }
    
    // Use Firebase Auth to create user
    const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
    const newUserId = userCredential.user.uid;
    
    // Create user document with rangeId
    await setDoc(doc(db, 'users', newUserId), {
      username: data.username,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      role: 'range_admin',
      rangeId: rangeId || null,
      rangeName: data.rangeName || '',
      rangeLocation: data.rangeLocation || '',
      phone: data.phone || '',
      isActive: true,
      isVerified: true,
      createdAt: serverTimestamp(),
    });
    
    return { data: { message: 'Range admin created', userId: newUserId } };
  },
};

// Ranges API - Manage physical shooting ranges
export const rangesAPI = {
  getAll: async (params = {}) => {
    const col = collection(db, 'ranges');
    const snap = await getDocs(col);
    let ranges = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Filter by active status if specified
    if (params?.active !== undefined) {
      ranges = ranges.filter(r => (r.isActive !== false) === params.active);
    }
    
    // Sort by name
    ranges.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    return { data: { ranges } };
  },
  getById: async (id) => {
    const snap = await getDoc(doc(db, 'ranges', id));
    if (!snap.exists()) throw new Error('Range not found');
    return { data: { range: { id: snap.id, ...snap.data() } } };
  },
  getByAdminId: async (adminId) => {
    // Find range by admin user ID - check if admin has rangeId or rangeName
    const userSnap = await getDoc(doc(db, 'users', adminId));
    if (!userSnap.exists()) throw new Error('User not found');
    const userData = userSnap.data();
    
    // Try to find range by rangeId first, then by rangeName
    if (userData.rangeId) {
      const rangeSnap = await getDoc(doc(db, 'ranges', userData.rangeId));
      if (rangeSnap.exists()) {
        return { data: { range: { id: rangeSnap.id, ...rangeSnap.data() } } };
      }
    }
    
    // If no rangeId, try to find by name
    if (userData.rangeName) {
      const rangesSnap = await getDocs(collection(db, 'ranges'));
      const ranges = rangesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const matchingRange = ranges.find(r => 
        r.name === userData.rangeName || 
        r.name?.toLowerCase() === userData.rangeName?.toLowerCase()
      );
      if (matchingRange) {
        return { data: { range: matchingRange } };
      }
    }
    
    // Return null if no range found
    return { data: { range: null } };
  },
  create: async (rangeData) => {
    const ref = await addDoc(collection(db, 'ranges'), {
      ...rangeData,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const snap = await getDoc(ref);
    return { data: { range: { id: ref.id, ...snap.data() } } };
  },
  update: async (id, rangeData) => {
    await updateDoc(doc(db, 'ranges', id), {
      ...rangeData,
      updatedAt: serverTimestamp(),
    });
    const snap = await getDoc(doc(db, 'ranges', id));
    return { data: { range: { id, ...snap.data() } } };
  },
  markAsPaid: async (id) => {
    const now = new Date();
    const renewalDate = new Date(now);
    renewalDate.setMonth(renewalDate.getMonth() + 1);
    
    // Get range document to find adminId
    const rangeSnap = await getDoc(doc(db, 'ranges', id));
    if (!rangeSnap.exists()) throw new Error('Range not found');
    const rangeData = rangeSnap.data();
    const adminId = rangeData.adminId;
    
    // Update range document
    await updateDoc(doc(db, 'ranges', id), {
      subscriptionStatus: 'active',
      subscriptionLastPaymentDate: now.toISOString(),
      subscriptionRenewalDate: renewalDate.toISOString(),
      updatedAt: serverTimestamp(),
    });
    
    // Also update the range admin's user document if adminId exists
    if (adminId) {
      try {
        const userSnap = await getDoc(doc(db, 'users', adminId));
        if (userSnap.exists()) {
          await updateDoc(doc(db, 'users', adminId), {
            subscriptionStatus: 'active',
            subscriptionLastPaymentDate: now.toISOString(),
            subscriptionRenewalDate: renewalDate.toISOString(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        // Log but don't fail if user update fails
        console.error('Failed to update user subscription status:', err);
      }
    }
    
    // Also update any users with this rangeId
    try {
      const usersSnap = await getDocs(query(collection(db, 'users'), where('rangeId', '==', id)));
      const updatePromises = usersSnap.docs.map(userDoc => 
        updateDoc(userDoc.ref, {
          subscriptionStatus: 'active',
          subscriptionLastPaymentDate: now.toISOString(),
          subscriptionRenewalDate: renewalDate.toISOString(),
          updatedAt: serverTimestamp(),
        })
      );
      await Promise.all(updatePromises);
    } catch (err) {
      console.error('Failed to update range admin users:', err);
    }
    
    const snap = await getDoc(doc(db, 'ranges', id));
    return { data: { range: { id, ...snap.data() } } };
  },
  delete: async (id) => {
    // Soft delete by marking as inactive
    await updateDoc(doc(db, 'ranges', id), {
      isActive: false,
      deletedAt: serverTimestamp(),
    });
    return { data: { message: 'Range deactivated' } };
  },
};

// Range Admin API - for range admins to manage their range
export const rangeAdminAPI = {
  getDashboard: async (params = {}) => {
    const { rangeId, period = '30-days' } = params;
    if (!rangeId) throw new Error('Range ID required');

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    switch (period) {
      case '7-days':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30-days':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90-days':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1-year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    const rangeDoc = await getDoc(doc(db, 'ranges', rangeId));
    const rangeRecord = rangeDoc.exists() ? { id: rangeDoc.id, ...rangeDoc.data() } : null;

    // Get competitions for this range
    const competitionsSnap = await getDocs(collection(db, 'competitions'));
    const allCompetitions = competitionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const rangeCompetitions = allCompetitions.filter(c =>
      c.range?.id === rangeId || c.range?.name === rangeId || c.rangeId === rangeId
    );

    // Get scores for these competitions
    const scoresSnap = await getDocs(collection(db, 'scores'));
    const allScores = scoresSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const competitionIds = rangeCompetitions.map(c => c.id);
    const rangeScores = allScores.filter(s => competitionIds.includes(s.competitionId));

    // Get registrations for these competitions
    const regsSnap = await getDocs(collection(db, 'registrations'));
    const allRegs = regsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const rangeRegs = allRegs.filter(r => competitionIds.includes(r.competitionId));

    // Helper to convert Firestore timestamp to Date
    const toDate = (ts) => {
      if (!ts) return null;
      if (ts.toMillis) return new Date(ts.toMillis());
      if (ts.toDate) return ts.toDate();
      if (typeof ts === 'string') return new Date(ts);
      if (typeof ts === 'number') return new Date(ts);
      return null;
    };

    // Calculate stats
    const activeCompetitions = rangeCompetitions.filter(c => c.status === 'published').length;
    const pendingScores = rangeScores.filter(s => (s.verificationStatus || 'pending') === 'pending').length;
    const totalRegistrations = rangeRegs.length;
    const newRegistrationsThisPeriod = rangeRegs.filter(r => {
      const created = toDate(r.createdAt || r.registeredAt);
      return created && created >= startDate;
    }).length;

    // Load revenue entries for this range
    let revenueEntries = [];
    try {
      const revenueQuery = query(
        collection(db, 'rangeRevenues'),
        where('rangeId', '==', rangeId)
      );
      const revenueSnap = await getDocs(revenueQuery);
      revenueEntries = revenueSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          approvedAt: toDate(data.approvedAt),
          createdAt: toDate(data.createdAt),
        };
      }).sort((a, b) => {
        const aTime = a.approvedAt ? a.approvedAt.getTime() : 0;
        const bTime = b.approvedAt ? b.approvedAt.getTime() : 0;
        return bTime - aTime;
      }).slice(0, 25);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error loading range revenue entries', err);
    }

    const revenueTotalsFromEntries = revenueEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
    const revenueThisPeriod = revenueEntries.reduce((sum, entry) => {
      if (!entry.approvedAt) return sum;
      return entry.approvedAt >= startDate ? sum + (entry.amount || 0) : sum;
    }, 0);

    const totalRevenue = rangeRecord?.revenue?.total != null
      ? rangeRecord.revenue.total
      : revenueTotalsFromEntries;
    const revenueEntryCount = rangeRecord?.revenue?.entryCount != null
      ? rangeRecord.revenue.entryCount
      : revenueEntries.length;

    return {
      stats: {
        totalCompetitions: rangeCompetitions.length,
        activeCompetitions,
        pendingScores,
        totalRegistrations,
        newRegistrationsThisPeriod,
        totalRevenue,
        revenueThisPeriod,
        revenueEntryCount,
      },
      range: rangeRecord,
      revenue: {
        entries: revenueEntries,
        totalRevenue,
        revenueThisPeriod,
      },
      payment: {
        subscriptionStatus: rangeRecord?.subscriptionStatus || null,
        renewalDate: rangeRecord?.subscriptionRenewalDate || null,
        lastPaymentDate: rangeRecord?.subscriptionLastPaymentDate || null,
        amount: rangeRecord?.subscriptionAmount || null,
        currency: rangeRecord?.subscriptionCurrency || 'USD',
      },
    };
  },

  getPendingScores: async (params = {}) => {
    const { rangeId } = params;
    if (!rangeId) throw new Error('Range ID required');

    // Get competitions for this range
    const competitionsSnap = await getDocs(collection(db, 'competitions'));
    const allCompetitions = competitionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const rangeCompetitions = allCompetitions.filter(c => 
      c.range?.id === rangeId || c.range?.name === rangeId || c.rangeId === rangeId
    );
    const competitionIds = rangeCompetitions.map(c => c.id);

    // Get pending scores for these competitions
    const scoresSnap = await getDocs(collection(db, 'scores'));
    const allScores = scoresSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const pendingScores = allScores.filter(s => 
      competitionIds.includes(s.competitionId) && 
      (s.verificationStatus || 'pending') === 'pending'
    );

    // Hydrate competitor and competition info
    const userIds = Array.from(new Set(pendingScores.map(s => s.competitorId || s.competitor?.id).filter(Boolean)));
    const userSnaps = await Promise.all(userIds.map(uid => getDoc(doc(db, 'users', uid))));
    const userMap = new Map();
    userSnaps.forEach((snap, i) => {
      if (snap.exists()) {
        userMap.set(userIds[i], { id: userIds[i], ...snap.data() });
      }
    });

    const scoresWithDetails = pendingScores.map(score => ({
      ...score,
      competitor: userMap.get(score.competitorId || score.competitor?.id) || null,
      competition: rangeCompetitions.find(c => c.id === score.competitionId) || null,
    }));

    return { data: { scores: scoresWithDetails } };
  },
};

// Shooting Classes API - placeholder
export const shootingClassesAPI = {
  getAll: async () => ({ shootingClasses: [] }),
  getByCategory: async () => ({ shootingClasses: [] }),
  getByName: async () => ({ class: null }),
};
