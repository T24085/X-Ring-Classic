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
  ShieldCheckIcon,
  ChevronDownIcon,
  ChartBarIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import { useState, useRef, useEffect } from 'react';

const Layout = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false);
  const adminDropdownRef = useRef(null);

  // Main navigation items (always visible)
  const mainNavigation = [
    { name: 'Home', href: '/', icon: HomeIcon },
    { name: 'Competitions', href: '/competitions', icon: TrophyIcon },
    { name: 'Leaderboard', href: '/leaderboard', icon: TrophyIcon },
    { name: 'Rulebook', href: '/rulebook', icon: StarIcon },
    { name: 'Shooting Classes', href: '/shooting-classes', icon: StarIcon },
  ];

  // Admin dropdown menu items
  const adminMenuItems = [
    { name: 'Dashboard', href: '/admin', icon: ChartBarIcon },
    { name: 'Range Management', href: '/admin/range-management', icon: ShieldCheckIcon },
    { name: 'Manage Users', href: '/admin/users', icon: UserGroupIcon },
    { name: 'Create Competition', href: '/admin/create-competition', icon: TrophyIcon },
    { name: 'Enter Score', href: '/admin/enter-score', icon: CheckCircleIcon },
    { name: 'Score Verification', href: '/admin/score-verification', icon: CheckCircleIcon },
  ];

  // Check if user has admin access
  const hasAdminAccess = user?.role === 'admin' || user?.role === 'range_admin';
  const isAdminRoute = location.pathname.startsWith('/admin');

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (adminDropdownRef.current && !adminDropdownRef.current.contains(event.target)) {
        setAdminDropdownOpen(false);
      }
    };

    if (adminDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [adminDropdownOpen]);

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
                  src={`${process.env.PUBLIC_URL}/TheXringClassic.png`} 
                  alt="The X-Ring Classic" 
                  className="h-12 w-auto object-contain"
                />
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-2">
              {/* Main navigation items */}
              {mainNavigation.map((item) => {
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

              {/* Profile link (if authenticated) */}
              {isAuthenticated && (
                <Link
                  to="/profile"
                  className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === '/profile'
                      ? 'text-rifle-600 bg-rifle-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <UserIcon className="w-4 h-4" />
                  <span>Profile</span>
                </Link>
              )}

              {/* Admin dropdown menu */}
              {hasAdminAccess && (
                <div className="relative" ref={adminDropdownRef}>
                  <button
                    onClick={() => setAdminDropdownOpen(!adminDropdownOpen)}
                    className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isAdminRoute
                        ? 'text-rifle-600 bg-rifle-50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <CogIcon className="w-4 h-4" />
                    <span>Admin</span>
                    <ChevronDownIcon className={`w-4 h-4 transition-transform ${adminDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown menu */}
                  {adminDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                      <div className="py-1" role="menu">
                        {adminMenuItems
                          .filter(item => {
                            // Filter based on role
                            if (item.href === '/admin/range-management' || item.href === '/admin/users') {
                              return user?.role === 'admin';
                            }
                            return true;
                          })
                          .map((item) => {
                            const isActive = location.pathname === item.href;
                            return (
                              <Link
                                key={item.name}
                                to={item.href}
                                onClick={() => setAdminDropdownOpen(false)}
                                className={`flex items-center space-x-2 px-4 py-2 text-sm transition-colors ${
                                  isActive
                                    ? 'bg-rifle-50 text-rifle-600'
                                    : 'text-gray-700 hover:bg-gray-50'
                                }`}
                                role="menuitem"
                              >
                                <item.icon className="w-4 h-4" />
                                <span>{item.name}</span>
                              </Link>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </nav>

            {/* User Menu */}
            <div className="hidden md:flex items-center space-x-4">
              {isAuthenticated ? (
                <>
                  <div className="flex items-center space-x-2">
                    {user?.classification ? (
                      <img
                        src={`${process.env.PUBLIC_URL}/${(user.classification.includes('Grand') ? 'GM' : user.classification).replace(' ', '')}.png`}
                        alt={user.classification}
                        className="w-8 h-8 object-contain"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-rifle-100 rounded-full flex items-center justify-center">
                        <span className="text-rifle-600 font-medium text-sm">
                          {user?.profile?.firstName?.[0] || user?.username?.[0] || 'U'}
                        </span>
                      </div>
                    )}
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

            {/* Mobile actions */}
            <div className="md:hidden flex items-center gap-3">
              {!isAuthenticated && (
                <>
                  <Link
                    to="/login"
                    className="text-sm text-gray-700 hover:text-gray-900"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="px-3 py-1 text-sm rounded-md bg-rifle-600 text-white hover:bg-rifle-700"
                  >
                    Register
                  </Link>
                </>
              )}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-gray-600 hover:text-gray-900"
                aria-label="Toggle menu"
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
              {/* Main navigation */}
              {mainNavigation.map((item) => {
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

              {/* Profile */}
              {isAuthenticated && (
                <Link
                  to="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === '/profile'
                      ? 'text-rifle-600 bg-rifle-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <UserIcon className="w-4 h-4" />
                  <span>Profile</span>
                </Link>
              )}

              {/* Admin section */}
              {hasAdminAccess && (
                <div className="pt-2 border-t border-gray-200">
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Admin
                  </div>
                  {adminMenuItems
                    .filter(item => {
                      if (item.href === '/admin/range-management' || item.href === '/admin/users') {
                        return user?.role === 'admin';
                      }
                      return true;
                    })
                    .map((item) => {
                      const isActive = location.pathname === item.href;
                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ml-4 ${
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
                </div>
              )}

              {/* Logout/Login */}
              {isAuthenticated ? (
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
              ) : (
                <div className="flex items-center gap-2 px-3 py-2">
                  <Link to="/login" className="text-sm text-gray-700 hover:text-gray-900" onClick={() => setMobileMenuOpen(false)}>Login</Link>
                  <Link to="/register" className="px-3 py-1 text-sm rounded-md bg-rifle-600 text-white hover:bg-rifle-700" onClick={() => setMobileMenuOpen(false)}>Register</Link>
                </div>
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
                src={`${process.env.PUBLIC_URL}/TheXringClassic.png`} 
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
