import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rifle-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login page with return url
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole) {
    // Handle both single role and array of roles
    const hasRequiredRole = Array.isArray(requiredRole) 
      ? requiredRole.includes(user?.role)
      : user?.role === requiredRole;
    
    if (!hasRequiredRole) {
      // Redirect to home page if user doesn't have required role
      return <Navigate to="/" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
