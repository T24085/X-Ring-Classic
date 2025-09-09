import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (userData) => api.post('/auth/register', userData),
  getCurrentUser: () => api.get('/auth/me'),
  changePassword: (currentPassword, newPassword) => 
    api.post('/auth/change-password', { currentPassword, newPassword }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  setAuthToken: (token) => {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  },
  removeAuthToken: () => {
    delete api.defaults.headers.common['Authorization'];
  },
};

// Competitions API
export const competitionsAPI = {
  getAll: (params) => api.get('/competitions', { params }),
  getById: (id) => api.get(`/competitions/${id}`),
  create: (competitionData) => api.post('/competitions', competitionData),
  update: (id, competitionData) => api.put(`/competitions/${id}`, competitionData),
  delete: (id) => api.delete(`/competitions/${id}`),
  publish: (id) => api.post(`/competitions/${id}/publish`),
  register: (id) => api.post(`/competitions/${id}/register`),
};

// Scores API
export const scoresAPI = {
  submit: (scoreData) => api.post('/scores', scoreData),
  submitOnBehalf: (scoreData) => api.post('/scores/admin', scoreData),
  getByCompetition: (competitionId) => api.get(`/scores/competition/${competitionId}`),
  getByUser: (userId, params) => api.get(`/scores/user/${userId}`, { params }),
  verify: (scoreId, status, notes) => 
    api.put(`/scores/${scoreId}/verify`, { status, notes }),
  flag: (scoreId, reason) => api.put(`/scores/${scoreId}/flag`, { reason }),
  getPendingVerification: () => api.get('/scores/pending-verification').then(r => r.data),
};

// Leaderboards API
export const leaderboardsAPI = {
  getIndoor: (params) => api.get('/leaderboards/indoor', { params }),
  getOutdoor: (params) => api.get('/leaderboards/outdoor', { params }),
  getByCompetition: (competitionId) => api.get(`/leaderboards/competition/${competitionId}`),
  getByFormat: (format, params) => api.get(`/leaderboards/format/${format}`, { params }),
  getOverall: (params) => api.get('/leaderboards/overall', { params }),
};

// Public API (no auth required)
export const publicAPI = {
  getStats: () => api.get('/public/stats').then(r => r.data),
};

// Users API
export const usersAPI = {
  getProfile: (userId) => api.get(`/users/profile/${userId}`),
  updateProfile: (profileData) => api.put('/users/profile', profileData),
  getScores: (userId, params) => api.get(`/users/${userId}/scores`, { params }),
  getCompetitions: (userId, params) => api.get(`/users/${userId}/competitions`, { params }),
  search: (query, params) => api.get('/users/search', { params: { q: query, ...params } }),
  getTopShooters: (params) => api.get('/users/top-shooters', { params }),
  verify: (userId) => api.put(`/users/${userId}/verify`),
  deactivate: (userId) => api.put(`/users/${userId}/deactivate`),
  updateRole: (userId, role) => api.put(`/users/${userId}/role`, { role }),
  delete: (userId) => api.delete(`/users/${userId}`),
};

// Admin API
export const adminAPI = {
  // Return response data and support query params
  getDashboard: (params) => api.get('/admin/dashboard', { params }).then(r => r.data),
  getUsers: (params) => api.get('/admin/users', { params }).then(r => r.data),
  getCompetitions: (params) => api.get('/admin/competitions', { params }).then(r => r.data),
  getScores: (params) => api.get('/admin/scores', { params }).then(r => r.data),
  updateCompetitionStatus: (competitionId, status) => 
    api.put(`/admin/competitions/${competitionId}/status`, { status }).then(r => r.data),
  deleteScore: (scoreId) => api.delete(`/admin/scores/${scoreId}`).then(r => r.data),
  getReports: (params) => api.get('/admin/reports', { params }).then(r => r.data),
  getRangeAdmins: (params) => api.get('/admin/range-admins', { params }).then(r => r.data),
  createRangeAdmin: (data) => api.post('/auth/create-range-admin', data).then(r => r.data),
};

// Shooting Classes API - Temporarily disabled during Firebase migration
export const shootingClassesAPI = {
  getAll: () => Promise.resolve({ shootingClasses: [] }),
  getByCategory: () => Promise.resolve({ shootingClasses: [] }),
  getByName: () => Promise.resolve(null),
  getUserClasses: () => Promise.resolve({ shootingClasses: {} }),
  updateUserClass: () => Promise.resolve({ success: false, message: 'Shooting classes temporarily unavailable' }),
  checkEligibility: () => Promise.resolve({ eligible: false, message: 'Shooting classes temporarily unavailable' }),
  getUserHistory: () => Promise.resolve({ history: [] }),
  getLeaderboard: () => Promise.resolve({ leaderboard: [] }),
  getStatistics: () => Promise.resolve({ statistics: {} }),
};

export default api;
