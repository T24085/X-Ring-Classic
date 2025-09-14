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
  orderBy,
  limit,
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
    if (params?.status && params.status !== 'all') filters.push(where('status', '==', params.status));
    if (params?.format && params.format !== 'all') filters.push(where('format', '==', params.format));
    if (params?.type && params.type !== 'all') filters.push(where('type', '==', params.type));
    const q = filters.length ? query(col, ...filters) : col;
    const snap = await getDocs(q);
    let competitions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
  getById: async (id) => {
    const compSnap = await getDoc(doc(db, 'competitions', id));
    if (!compSnap.exists()) throw new Error('Competition not found');

    // Hydrate participants from registrations collection
    const regsSnap = await getDocs(query(collection(db, 'registrations'), where('competitionId', '==', id)));
    const regs = regsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const userIds = Array.from(new Set(regs.map(r => r.userId).filter(Boolean)));
    const userSnaps = await Promise.all(userIds.map(uid => getDoc(doc(db, 'users', uid))));
    const userMap = new Map(userSnaps.map((s, i) => [userIds[i], s.exists() ? { id: userIds[i], ...s.data() } : null]));
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

    // Create registration and bump counts in competition
    await addDoc(collection(db, 'registrations'), {
      competitionId: id,
      userId: uid,
      status: 'registered',
      registeredAt: new Date().toISOString(),
    });

    const currentCount = competition.participantCount || competition.registeredCount || (Array.isArray(competition.participants) ? competition.participants.length : 0) || 0;
    await updateDoc(doc(db, 'competitions', id), {
      participantCount: currentCount + 1,
      registeredCount: (competition.registeredCount || currentCount) + 1,
    });
    return { data: { message: 'Successfully registered for competition' } };
  },
};

// Scores API (minimal)
export const scoresAPI = {
  submit: async (scoreData) => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');
    const payload = {
      ...scoreData,
      competitorId: uid,
      createdAt: serverTimestamp(),
      verificationStatus: 'pending',
    };
    const ref = await addDoc(collection(db, 'scores'), payload);
    const snap = await getDoc(ref);
    return { data: { score: { id: ref.id, ...snap.data() } } };
  },
  submitOnBehalf: async (scoreData) => {
    // For client-only: same as submit but accept competitorId in payload
    const uid = scoreData?.competitorId || auth.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');
    const payload = {
      ...scoreData,
      competitorId: uid,
      createdAt: serverTimestamp(),
      verificationStatus: 'pending',
    };
    const ref = await addDoc(collection(db, 'scores'), payload);
    const snap = await getDoc(ref);
    return { data: { score: { id: ref.id, ...snap.data() } } };
  },
  getByCompetition: async (competitionId) => {
    const snap = await getDocs(query(collection(db, 'scores'), where('competitionId', '==', competitionId)));
    const scores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
    // Firestore requires composite indexes for complex order/filters; keep simple
    const lim = Number(params?.limit || 10);
    const snap = await getDocs(query(collection(db, 'scores')));
    let scores = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(s => s.verificationStatus === 'approved' || !s.verificationStatus)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, lim);

    // Populate competitor profiles
    const ids = Array.from(new Set(scores.map(s => s.competitorId).filter(Boolean)));
    const userSnaps = await Promise.all(ids.map(uid => getDoc(doc(db, 'users', uid))));
    const userMap = new Map(userSnaps.map((s, i) => [ids[i], s.exists() ? { id: ids[i], ...s.data() } : null]));

    const leaderboard = scores.map((s, idx) => {
      const u = userMap.get(s.competitorId);
      const competitor = u ? u : { id: s.competitorId, username: s.username || 'user', firstName: 'Shooter', lastName: '' };
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
  getIndoor: async (params = {}) => leaderboardsAPI.getOverall(params),
  getOutdoor: async (params = {}) => leaderboardsAPI.getOverall(params),
  getByCompetition: async (competitionId) => {
    const snap = await getDocs(query(collection(db, 'scores'), where('competitionId', '==', competitionId)));
    let scores = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(s => s.verificationStatus === 'approved' || !s.verificationStatus)
      .sort((a, b) => (b.score || 0) - (a.score || 0));

    const ids = Array.from(new Set(scores.map(s => s.competitorId).filter(Boolean)));
    const userSnaps = await Promise.all(ids.map(uid => getDoc(doc(db, 'users', uid))));
    const userMap = new Map(userSnaps.map((s, i) => [ids[i], s.exists() ? { id: ids[i], ...s.data() } : null]));

    const leaderboard = scores.map((s, idx) => {
      const u = userMap.get(s.competitorId);
      const competitor = u ? u : { id: s.competitorId, username: s.username || 'user', firstName: 'Shooter', lastName: '' };
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
    const [comps, scores, users] = await Promise.all([
      getDocs(collection(db, 'competitions')),
      getDocs(collection(db, 'scores')),
      getDocs(collection(db, 'users')),
    ]);
    // Map to keys expected by Home page
    const activeCompetitions = comps.docs.filter(d => (d.data()?.status || '') === 'published').length;
    return {
      activeCompetitions,
      totalUsers: users.size,
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
  updateRole: async (userId, role) => {
    const actor = auth.currentUser;
    if (!actor) throw new Error('Not authenticated');
    const actorSnap = await getDoc(doc(db, 'users', actor.uid));
    const actorRole = actorSnap.exists() ? actorSnap.data()?.role : undefined;
    if (actorRole !== 'admin') throw new Error('Admin only');
    const allowed = ['competitor', 'range_officer', 'range_admin', 'admin'];
    if (!allowed.includes(role)) throw new Error('Invalid role');
    await updateDoc(doc(db, 'users', userId), { role, updatedAt: serverTimestamp() });
    return { data: { message: 'Role updated' } };
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
  getDashboard: async () => {
    const totals = await publicAPI.getStats();
    return {
      stats: {
        totalUsers: totals.totalUsers || 0,
        activeCompetitions: totals.activeCompetitions || 0,
        totalCompetitions: totals.activeCompetitions || 0,
        totalScores: totals.totalScores || 0,
      },
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
  getRangeAdmins: async () => ({ data: [] }),
  createRangeAdmin: async () => ({ data: { message: 'Not implemented in static build' } }),
};

// Shooting Classes API - placeholder
export const shootingClassesAPI = {
  getAll: async () => ({ shootingClasses: [] }),
  getByCategory: async () => ({ shootingClasses: [] }),
  getByName: async () => ({ class: null }),
};
