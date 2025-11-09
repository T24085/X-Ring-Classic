import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Competitions from './pages/Competitions';
import CompetitionDetail from './pages/CompetitionDetail';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import CreateCompetition from './pages/CreateCompetition';
import EditCompetition from './pages/EditCompetition';
import ScoreSubmission from './pages/ScoreSubmission';
import TestPage from './pages/TestPage';
import ShootingClasses from './pages/ShootingClasses';
import ScoreVerification from './pages/ScoreVerification';
import RangeAdminManagement from './pages/RangeAdminManagement';
import RangeAdminDashboard from './pages/RangeAdminDashboard';
import RangeAdminSignup from './pages/auth/RangeAdminSignup';
import RangeAdminSubscription from './pages/RangeAdminSubscription';
import AdminSettings from './pages/AdminSettings';
import AdminEnterScore from './pages/AdminEnterScore';
import AdminUserManagement from './pages/AdminUserManagement';
import XRingClassicRulebook from './pages/XRingClassicRulebook';
import Ranges from './pages/Ranges';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  const { user } = useAuth();

  return (
    <div className="App">
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/range-admin/signup" element={<RangeAdminSignup />} />

        {/* Protected routes with layout */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="competitions" element={<Competitions />} />
          <Route path="competitions/:id" element={<CompetitionDetail />} />
          <Route path="competitions/:id/edit" element={
            <ProtectedRoute requiredRole={["admin", "range_admin"]}>
              <EditCompetition />
            </ProtectedRoute>
          } />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="leaderboard/:type" element={<Leaderboard />} />
          <Route path="shooting-classes" element={<ShootingClasses />} />
          <Route path="ranges" element={<Ranges />} />
          <Route path="rulebook" element={<XRingClassicRulebook />} />
          
          {/* Protected routes */}
          <Route path="profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
          <Route path="profile/:userId" element={
            <ProtectedRoute requiredRole="admin">
              <Profile />
            </ProtectedRoute>
          } />
          
          <Route path="submit-score/:competitionId" element={
            <ProtectedRoute>
              <ScoreSubmission />
            </ProtectedRoute>
          } />
          
          {/* Range Admin routes */}
          <Route path="range-admin" element={
            <ProtectedRoute requiredRole="range_admin" requireActiveSubscription>
              <RangeAdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="range-admin/subscription" element={
            <ProtectedRoute requiredRole="range_admin">
              <RangeAdminSubscription />
            </ProtectedRoute>
          } />

          {/* Admin routes */}
          <Route path="admin" element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="admin/create-competition" element={
            <ProtectedRoute requiredRole={["admin", "range_admin"]} requireActiveSubscription>
              <CreateCompetition />
            </ProtectedRoute>
          } />
          <Route path="admin/score-verification" element={
            <ProtectedRoute requiredRole={['admin', 'range_admin']} requireActiveSubscription>
              <ScoreVerification />
            </ProtectedRoute>
          } />
          <Route path="admin/enter-score" element={
            <ProtectedRoute requiredRole={["admin", "range_admin"]} requireActiveSubscription>
              <AdminEnterScore />
            </ProtectedRoute>
          } />
          <Route path="admin/range-management" element={
            <ProtectedRoute requiredRole="admin">
              <RangeAdminManagement />
            </ProtectedRoute>
          } />
          <Route path="admin/users" element={
            <ProtectedRoute requiredRole="admin">
              <AdminUserManagement />
            </ProtectedRoute>
          } />
          <Route path="admin/settings" element={
            <ProtectedRoute requiredRole="admin">
              <AdminSettings />
            </ProtectedRoute>
          } />
          
          {/* Test route */}
          <Route path="test" element={<TestPage />} />
        </Route>
      </Routes>
    </div>
  );
}

export default App;
