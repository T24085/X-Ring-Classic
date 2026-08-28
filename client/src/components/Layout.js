import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  HomeIcon,
  TrophyIcon,
  UserIcon,
  CogIcon,
  ArrowRightOnRectangleIcon,
  ArrowUpRightIcon,
  Bars3Icon,
  XMarkIcon,
  StarIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  ChevronDownIcon,
  ChartBarIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  MegaphoneIcon,
  ShoppingBagIcon
} from '@heroicons/react/24/outline';
import { useState, useRef, useEffect } from 'react';

const PUBLIC_EXACT_PATHS = new Set([
  '/',
  '/competitions',
  '/leaderboard',
  '/shooting-classes',
  '/ranges',
  '/rulebook',
  '/pitch-deck',
  '/sponsorship',
]);

const ColbyChristieBanner = () => (
  <aside className="block w-full self-stretch">
    <div className="relative mx-auto flex w-full max-w-[18rem] flex-col overflow-hidden rounded-xl border border-yellow-700/60 bg-black shadow-xl lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:min-h-[36rem]">
      <img
        src={`${process.env.PUBLIC_URL}/colby-christie-gunsmithing.png`}
        alt="Colby Christie Gunsmithing — precision, reliability, performance"
        className="block h-auto w-full flex-none object-contain"
        loading="lazy"
      />
      <div className="flex min-h-[7rem] flex-1 flex-col items-center justify-center bg-gradient-to-b from-black via-gray-950 to-black px-3 py-5 text-center text-yellow-500">
        <div className="mb-3 h-px w-2/3 bg-yellow-600/60" />
        <p className="text-[10px] font-bold uppercase tracking-[0.18em]">Colby Christie</p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-300">Gunsmithing</p>
        <p className="mt-3 text-[9px] uppercase tracking-[0.12em] text-yellow-700">Precision · Reliability · Performance</p>
      </div>
    </div>
  </aside>
);

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
    { name: 'Ranges', href: '/ranges', icon: ShieldCheckIcon },
    { name: 'Rulebook', href: '/rulebook', icon: StarIcon },
    { name: 'Shooting Classes', href: '/shooting-classes', icon: StarIcon },
  ];

  // Admin dropdown menu items (for full admins)
  const adminMenuItems = [
    { name: 'Dashboard', href: '/admin', icon: ChartBarIcon },
    { name: 'Range Management', href: '/admin/range-management', icon: ShieldCheckIcon },
    { name: 'Manage Users', href: '/admin/users', icon: UserGroupIcon },
    { name: 'Create Competition', href: '/admin/create-competition', icon: TrophyIcon },
    { name: 'Enter Score', href: '/admin/enter-score', icon: CheckCircleIcon },
    { name: 'Score Verification', href: '/admin/score-verification', icon: CheckCircleIcon },
    { name: 'Pitch Deck', href: '/pitch-deck', icon: MegaphoneIcon },
    { name: 'Sponsor Dashboard', href: '/dashboard/sponsor', icon: ChartBarIcon },
  ];

  // Range Admin menu items
  const rangeAdminMenuItems = [
    { name: 'Range Dashboard', href: '/range-admin', icon: ChartBarIcon },
    { name: 'Create Competition', href: '/admin/create-competition', icon: TrophyIcon },
    { name: 'Score Verification', href: '/admin/score-verification', icon: CheckCircleIcon },
    { name: 'Subscription', href: '/range-admin/subscription', icon: CurrencyDollarIcon },
  ];

  // Check if user has admin access
  const hasAdminAccess = user?.role === 'admin' || user?.role === 'range_admin';
  const isRangeAdmin = user?.role === 'range_admin' && user?.role !== 'admin';
  const isAdminRoute = location.pathname.startsWith('/admin');
  const showSponsorDashboard = user?.role === 'sponsor' || user?.role === 'admin';
  const isPublicPage = PUBLIC_EXACT_PATHS.has(location.pathname)
    || (location.pathname.startsWith('/competitions/') && !location.pathname.endsWith('/edit'))
    || location.pathname.startsWith('/leaderboard/');

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

  const filteredAdminMenuItems = (isRangeAdmin ? rangeAdminMenuItems : adminMenuItems).filter(item => {
    if (item.href === '/admin/range-management' || item.href === '/admin/users') {
      return user?.role === 'admin';
    }
    if (item.href === '/dashboard/sponsor') {
      return showSponsorDashboard;
    }
    return true;
  });

  return (
    <div className="min-h-screen relative z-10">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0d13]/95 shadow-[0_16px_45px_rgba(0,0,0,0.3)] backdrop-blur-xl">
        <div className="border-b border-white/5 bg-black/20">
          <div className="mx-auto flex max-w-[92rem] items-center justify-between px-4 py-2 sm:px-6 lg:px-8">
            <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-gray-500 sm:text-[10px]">
              The X-Ring Classic <span className="px-1 text-red-500">/</span> Precision in every round
            </p>
            <a
              href="https://shop.gunguysii.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400 transition-colors hover:text-yellow-400 sm:flex"
            >
              Gun Guys II online shop
              <ArrowUpRightIcon className="h-3 w-3" />
            </a>
          </div>
        </div>

        <div className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-[76px] items-center gap-4 lg:gap-6">
            {/* Brand lockup */}
            <Link to="/" className="group flex shrink-0 items-center gap-3" aria-label="The X-Ring Classic home">
              <span className="relative flex h-12 w-[4.5rem] items-center justify-center overflow-hidden rounded-lg border border-white/15 bg-black/45 shadow-lg shadow-black/20 backdrop-blur-sm transition-transform duration-300 group-hover:-translate-y-0.5">
                <img
                  src={`${process.env.PUBLIC_URL}/x-ring-classic-logo.png`}
                  alt="The X-Ring Classic"
                  className="h-full w-full object-contain"
                />
              </span>
            </Link>

            {/* Desktop navigation */}
            <nav className="ml-auto hidden items-center gap-0.5 lg:flex" aria-label="Primary navigation">
              {mainNavigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={`group relative flex items-center gap-2 px-3 py-7 text-[10px] font-semibold uppercase tracking-[0.13em] transition-colors duration-200 xl:px-3.5 ${
                      isActive ? 'text-white' : 'text-gray-500 hover:text-gray-100'
                    }`}
                  >
                    <item.icon className={`h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 ${isActive ? 'text-red-400' : 'text-gray-600 group-hover:text-red-400'}`} />
                    <span>{item.name}</span>
                    <span className={`absolute bottom-0 left-3 right-3 h-0.5 origin-center rounded-full bg-red-500 transition-transform duration-200 xl:left-3.5 xl:right-3.5 ${isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`} />
                  </Link>
                );
              })}

              {isAuthenticated && (
                <Link
                  to="/profile"
                  aria-current={location.pathname === '/profile' ? 'page' : undefined}
                  className={`group relative flex items-center gap-2 px-3 py-7 text-[10px] font-semibold uppercase tracking-[0.13em] transition-colors duration-200 ${location.pathname === '/profile' ? 'text-white' : 'text-gray-500 hover:text-gray-100'}`}
                >
                  <UserIcon className={`h-4 w-4 ${location.pathname === '/profile' ? 'text-red-400' : 'text-gray-600 group-hover:text-red-400'}`} />
                  <span>Profile</span>
                  <span className={`absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-red-500 transition-transform duration-200 ${location.pathname === '/profile' ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`} />
                </Link>
              )}

              {hasAdminAccess && (
                <div className="relative z-[100]" ref={adminDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setAdminDropdownOpen(!adminDropdownOpen)}
                    aria-expanded={adminDropdownOpen}
                    className={`group relative flex items-center gap-2 px-3 py-7 text-[10px] font-semibold uppercase tracking-[0.13em] transition-colors duration-200 ${isAdminRoute ? 'text-white' : 'text-gray-500 hover:text-gray-100'}`}
                  >
                    <CogIcon className={`h-4 w-4 ${isAdminRoute ? 'text-red-400' : 'text-gray-600 group-hover:text-red-400'}`} />
                    <span>Admin</span>
                    <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform duration-200 ${adminDropdownOpen ? 'rotate-180 text-red-400' : ''}`} />
                    <span className={`absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-red-500 transition-transform duration-200 ${isAdminRoute ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`} />
                  </button>

                  {adminDropdownOpen && (
                    <div className="absolute right-0 top-[calc(100%-0.5rem)] z-[9999] w-64 overflow-hidden rounded-2xl border-2 border-red-900/80 bg-gray-950 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.8)] ring-1 ring-white/10">
                      <div className="border-b border-white/15 px-3 pb-2 pt-1">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-red-400">Control room</p>
                        <p className="mt-1 text-xs text-gray-300">Manage the competition platform</p>
                      </div>
                      <div className="mt-2 space-y-1" role="menu">
                        {filteredAdminMenuItems.map((item) => {
                          const isActive = location.pathname === item.href;
                          return (
                            <Link
                              key={item.name}
                              to={item.href}
                              onClick={() => setAdminDropdownOpen(false)}
                              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs transition-colors ${isActive ? 'bg-red-500/25 text-white' : 'text-gray-200 hover:bg-white/10 hover:text-white'}`}
                              role="menuitem"
                            >
                              <item.icon className={`h-4 w-4 ${isActive ? 'text-red-400' : 'text-gray-600'}`} />
                              <span>{item.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <a
                href="https://shop.gunguysii.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-600 px-3.5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white shadow-lg shadow-red-950/30 transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-500 hover:shadow-red-950/50"
              >
                <ShoppingBagIcon className="h-4 w-4" />
                <span>Shop</span>
                <ArrowUpRightIcon className="h-3.5 w-3.5" />
              </a>
            </nav>

            {/* Desktop account utility */}
            <div className="hidden items-center gap-3 border-l border-white/10 pl-4 lg:flex">
              {isAuthenticated ? (
                <>
                  <Link to="/profile" className="group flex items-center gap-2" title="Open profile">
                    {user?.classification && typeof user.classification === 'string' ? (
                      <img
                        src={`${process.env.PUBLIC_URL}/${(user.classification.includes('Grand') ? 'GM' : user.classification).replace(/\s+/g, '')}.png`}
                        alt={user.classification}
                        className="h-8 w-8 object-contain"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/10 text-xs font-semibold text-gray-200 ${user?.classification && typeof user.classification === 'string' ? 'hidden' : ''}`}>
                      {user?.profile?.firstName?.[0] || user?.username?.[0] || 'U'}
                    </span>
                    <span className="hidden max-w-20 truncate text-xs font-medium text-gray-400 transition-colors group-hover:text-white xl:block">
                      {user?.profile?.firstName || user?.username}
                    </span>
                  </Link>
                  <button onClick={handleLogout} className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-white/5 hover:text-white" aria-label="Log out" title="Log out">
                    <ArrowRightOnRectangleIcon className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500 transition-colors hover:text-white">Login</Link>
                  <Link to="/register" className="rounded-lg border border-white/15 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-300 transition-colors hover:border-red-400/50 hover:bg-white/5 hover:text-white">Register</Link>
                </>
              )}
            </div>

            {/* Mobile actions */}
            <div className="ml-auto flex items-center gap-2 lg:hidden">
              {!isAuthenticated && (
                <Link to="/login" className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 transition-colors hover:text-white sm:block">Login</Link>
              )}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="rounded-lg border border-white/10 p-2 text-gray-300 transition-colors hover:border-red-400/40 hover:bg-white/5 hover:text-white"
                aria-expanded={mobileMenuOpen}
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              >
                {mobileMenuOpen ? <XMarkIcon className="h-5 w-5" /> : <Bars3Icon className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile navigation */}
        {mobileMenuOpen && (
          <div className="border-t border-white/10 bg-[#0d1119] lg:hidden">
            <nav className="mx-auto max-w-[92rem] space-y-1 px-4 py-4 sm:px-6" aria-label="Mobile navigation">
              <div className="mb-3 grid grid-cols-2 gap-2 border-b border-white/10 pb-4 sm:grid-cols-3">
                {mainNavigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors ${isActive ? 'border-red-500/40 bg-red-500/10 text-white' : 'border-white/5 bg-white/[0.02] text-gray-400 hover:border-white/15 hover:text-white'}`}
                    >
                      <item.icon className={`h-4 w-4 ${isActive ? 'text-red-400' : 'text-gray-600'}`} />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>

              {isAuthenticated && (
                <Link to="/profile" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-gray-300 transition-colors hover:bg-white/5 hover:text-white">
                  <UserIcon className="h-4 w-4 text-gray-500" />
                  <span>Profile</span>
                </Link>
              )}

              <a
                href="https://shop.gunguysii.com/"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-600 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-white transition-colors hover:bg-red-500"
              >
                <ShoppingBagIcon className="h-4 w-4" />
                Shop Gun Guys II
                <ArrowUpRightIcon className="h-3.5 w-3.5" />
              </a>

              {hasAdminAccess && (
                <div className="mt-3 border-t border-white/10 pt-3">
                  <p className="px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.24em] text-red-400">{isRangeAdmin ? 'Range admin' : 'Admin'}</p>
                  {filteredAdminMenuItems.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                      <Link key={item.name} to={item.href} onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors ${isActive ? 'bg-red-500/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
                        <item.icon className={`h-4 w-4 ${isActive ? 'text-red-400' : 'text-gray-600'}`} />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}

              {isAuthenticated ? (
                <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} className="mt-3 flex w-full items-center gap-3 border-t border-white/10 px-3 pt-4 text-sm text-gray-400 transition-colors hover:text-white">
                  <ArrowRightOnRectangleIcon className="h-4 w-4" />
                  <span>Log out</span>
                </button>
              ) : (
                <div className="mt-3 flex items-center gap-4 border-t border-white/10 px-3 pt-4">
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="text-sm text-gray-400 hover:text-white">Login</Link>
                  <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="rounded-lg border border-white/15 px-3 py-2 text-sm text-gray-300 hover:border-red-400/50 hover:text-white">Register</Link>
                </div>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
        {isPublicPage ? (
          <div className="relative grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_minmax(0,10rem)] xl:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,14rem)] 2xl:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_minmax(0,16rem)] xl:gap-6">
            <ColbyChristieBanner />
            <div className="order-2 min-w-0 lg:order-none">
              <Outlet />
            </div>
            <ColbyChristieBanner />
          </div>
        ) : (
          <Outlet />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-950/95 backdrop-blur-sm border-t border-red-900 mt-auto text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            {/* Banner in Footer */}
            <div className="mb-6">
              <img 
                src={`${process.env.PUBLIC_URL}/x-ring-classic-logo.png`}
                alt="The X-Ring Classic" 
                className="h-16 w-auto mx-auto object-contain"
              />
            </div>
            <div className="text-gray-400 text-sm">
              <p>&copy; 2024 The X-Ring Classic. All rights reserved.</p>
              <p className="mt-2">
                Powered by precision and passion
              </p>
              <p className="mt-4">
                <a 
                  href="https://www.thegunguys.net/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:text-white underline transition-colors"
                >
                  Visit Gun Guys II
                </a>
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
