import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useQuery } from 'react-query';
import { rangesAPI } from '../services/api.firebase';

const ProtectedRoute = ({ children, requiredRole, requireActiveSubscription = false }) => {
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

    const requiresRangeAdmin = Array.isArray(requiredRole)
      ? requiredRole.includes('range_admin')
      : requiredRole === 'range_admin';

    if (requiresRangeAdmin && requireActiveSubscription && user?.role === 'range_admin') {
      // Check subscription status from user document first
      let subscriptionStatus =
        user?.subscriptionStatus ||
        user?.rangeSubscription?.status ||
        user?.subscription?.status ||
        'inactive';

      // If user status is inactive, also check range document as fallback
      // Use a query to check range subscription status (hooks must be called unconditionally)
      const shouldCheckRange = !['active', 'trialing'].includes(subscriptionStatus) && user?.rangeId;
      const { data: rangeData, isLoading: rangeLoading } = useQuery(
        ['range-subscription-check', user?.rangeId],
        () => rangesAPI.getById(user.rangeId),
        {
          enabled: shouldCheckRange,
          staleTime: 2 * 60 * 1000,
          retry: false,
        }
      );
      
      // Update subscription status from range if available
      if (shouldCheckRange && rangeData?.data?.range?.subscriptionStatus) {
        subscriptionStatus = rangeData.data.range.subscriptionStatus;
      }

      // Wait for range check to complete if we're checking it
      if (shouldCheckRange && rangeLoading) {
        return (
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rifle-600"></div>
          </div>
        );
      }

      if (!['active', 'trialing'].includes(subscriptionStatus)) {
        return <Navigate to="/range-admin/subscription" state={{ from: location }} replace />;
      }
    }
  }

  return children;
};

export default ProtectedRoute;
