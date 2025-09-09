import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  HomeIcon,
  TrophyIcon,
  UserIcon,
  CogIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  StarIcon,
  CheckCircleIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { useState } from 'react';

const Layout = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { name: 'Home', href: '/', icon: HomeIcon },
    { name: 'Competitions', href: '/competitions', icon: TrophyIcon },
    { name: 'Leaderboard', href: '/leaderboard', icon: TrophyIcon },
    { name: 'Rulebook', href: '/rulebook', icon: StarIcon },
    { name: 'Shooting Classes', href: '/shooting-classes', icon: StarIcon },
    ...(isAuthenticated ? [{ name: 'Profile', href: '/profile', icon: UserIcon }] : []),
    ...(user?.role === 'admin' ? [{ name: 'Admin', href: '/admin', icon: CogIcon }] : []),
    ...(user?.role === 'admin' ? [{ name: 'Range Management', href: '/admin/range-management', icon: ShieldCheckIcon }] : []),
    ...(user?.role === 'admin' ? [{ name: 'Manage Users', href: '/admin/users', icon: ShieldCheckIcon }] : []),
    ...(user?.role === 'range_admin' || user?.role === 'admin' ? [{ name: 'Create Competition', href: '/admin/create-competition', icon: TrophyIcon }] : []),
    ...(user?.role === 'range_admin' || user?.role === 'admin' ? [{ name: 'Enter Score', href: '/admin/enter-score', icon: CheckCircleIcon }] : []),
    ...(user?.role === 'range_admin' || user?.role === 'admin' ? [{ name: 'Score Verification', href: '/admin/score-verification', icon: CheckCircleIcon }] : []),
  ];

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-3">
                <img 
                  src="/TheXringClassic.png" 
                  alt="The X-Ring Classic" 
                  className="h-12 w-auto object-contain"
                />
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex flex-wrap items-center gap-4">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'text-rifle-600 bg-rifle-50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* User Menu */}
            <div className="hidden md:flex items-center space-x-4">
              {isAuthenticated ? (
                <>
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-rifle-100 rounded-full flex items-center justify-center">
                      <span className="text-rifle-600 font-medium text-sm">
                        {user?.profile?.firstName?.[0] || user?.username?.[0] || 'U'}
                      </span>
                    </div>
                    <span className="text-sm text-gray-700">
                      {user?.profile?.firstName || user?.username}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-1 text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <ArrowRightOnRectangleIcon className="w-4 h-4" />
                    <span className="text-sm">Logout</span>
                  </button>
                </>
              ) : (
                <div className="flex items-center space-x-4">
                  <Link
                    to="/login"
                    className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="btn-primary text-sm"
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-gray-600 hover:text-gray-900"
              >
                {mobileMenuOpen ? (
                  <XMarkIcon className="w-6 h-6" />
                ) : (
                  <Bars3Icon className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200">
            <nav className="px-4 py-2 space-y-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'text-rifle-600 bg-rifle-50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
              {isAuthenticated && (
                <button
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 w-full"
                >
                  <ArrowRightOnRectangleIcon className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            {/* Banner in Footer */}
            <div className="mb-6">
              <img 
                src="/TheXringClassic.png" 
                alt="The X-Ring Classic" 
                className="h-16 w-auto mx-auto object-contain"
              />
            </div>
            <div className="text-gray-600 text-sm">
              <p>&copy; 2024 The X-Ring Classic. All rights reserved.</p>
              <p className="mt-2">
                Powered by precision and passion
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
