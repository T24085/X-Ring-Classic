import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import { competitionsAPI, leaderboardsAPI, publicAPI } from '../services/api.firebase';
import { 
  TrophyIcon, 
  CalendarIcon, 
  MapPinIcon, 
  UsersIcon,
  ArrowRightIcon,
  ViewfinderCircleIcon,
  MegaphoneIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';

const Home = () => {
  const { isAuthenticated } = useAuth();
  
  const getClassStyles = (classification) => {
    // Normalize classification - remove "Provisional" prefix and handle "Rookie"
    const normalized = (classification || '').toLowerCase().replace(/^provisional\s+/, '');
    switch (normalized) {
      case 'grand master':
        return 'bg-purple-600 text-white border-2 border-purple-700';
      case 'master':
        return 'bg-blue-600 text-white border-2 border-blue-700';
      case 'diamond':
        return 'bg-cyan-500 text-white border-2 border-cyan-600';
      case 'platinum':
        return 'bg-slate-500 text-white border-2 border-slate-600';
      case 'gold':
        return 'bg-yellow-500 text-yellow-900 border-2 border-yellow-600';
      case 'bronze':
        return 'bg-orange-600 text-white border-2 border-orange-700';
      case 'rookie':
        return 'bg-gray-800/50 text-gray-300 border border-gray-700';
      default:
        return 'bg-gray-800/50 text-gray-300 border border-gray-700';
    }
  };

  const getClassDescription = (classification) => {
    switch ((classification || '').toLowerCase()) {
      case 'grand master':
        return 'Avg score ≥ 95 (elite)';
      case 'master':
        return 'Avg score ≥ 92';
      case 'diamond':
        return 'Avg score ≥ 89';
      case 'platinum':
        return 'Avg score ≥ 85';
      case 'gold':
        return 'Avg score ≥ 80';
      case 'bronze':
        return 'Developing shooter';
      default:
        return 'Classification pending';
    }
  };

  const getClassRowBg = (classification) => {
    // Normalize classification - remove "Provisional" prefix and handle "Rookie"
    const normalized = (classification || '').toLowerCase().replace(/^provisional\s+/, '');
    switch (normalized) {
      case 'grand master':
        return 'bg-purple-600/15';
      case 'master':
        return 'bg-blue-600/15';
      case 'diamond':
        return 'bg-cyan-500/15';
      case 'platinum':
        return 'bg-slate-500/15';
      case 'gold':
        return 'bg-yellow-500/15';
      case 'bronze':
        return 'bg-orange-600/15';
      case 'rookie':
        return 'bg-gray-50';
      default:
        return 'bg-gray-50';
    }
  };

  // Legend descriptions (250-point card scale + X averages)
  const getLegendDescription = (classification) => {
    switch ((classification || '').toLowerCase()) {
      case 'grand master':
        return '249.0–250.0 avg, 15+ X avg';
      case 'master':
        return '247.0–248.9 avg, 10+ X avg';
      case 'diamond':
        return '245.0–246.9 avg, 8+ X avg';
      case 'platinum':
        return '242.0–244.9 avg, 6+ X avg';
      case 'gold':
        return '238.0–241.9 avg, 4+ X avg';
      case 'bronze':
        return 'Below 238.0 avg';
      default:
        return 'Classification pending';
    }
  };
  const { data: competitions, isLoading: competitionsLoading, error: competitionsError } = useQuery(
    ['featured-competitions'],
    async () => {
      try {
        const response = await competitionsAPI.getAll({ status: 'published', limit: 3 });
        return response.data;
      } catch (err) {
        console.error('Home: Competitions error:', err);
        throw err;
      }
    },
    { 
      staleTime: 5 * 60 * 1000, // 5 minutes
      enabled: true, // Always enabled - data should be visible to all authenticated users
      retry: 2,
    }
  );

  const { data: topShooters, isLoading: shootersLoading, error: shootersError } = useQuery(
    ['top-shooters'],
    async () => {
      try {
        const response = await leaderboardsAPI.getOverall({ limit: 5 });
        return response.data;
      } catch (err) {
        console.error('Home: Top shooters error:', err);
        throw err;
      }
    },
    { 
      staleTime: 10 * 60 * 1000, // 10 minutes
      enabled: true, // Always enabled - data should be visible to all authenticated users
      retry: 2,
    }
  );

  // Landing stats
  const { data: landingStats, error: statsError } = useQuery(
    ['landing-stats'],
    () => publicAPI.getStats(),
    { 
      staleTime: 2 * 60 * 1000,
      enabled: true,
      retry: 2,
    }
  );

  // Small-screen quick auth CTA
  const MobileAuthCta = () => (
      <div className="sm:hidden mb-4">
      <div className="bg-white border-2 border-red-800 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">Welcome to The X-Ring Classic</p>
          <p className="text-base font-medium text-gray-900">Sign in or create an account</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login" className="text-sm text-gray-700 hover:text-gray-900">Login</Link>
          <Link to="/register" className="px-3 py-1 text-sm rounded-md bg-gray-700 text-white hover:bg-gray-600">Register</Link>
        </div>
      </div>
    </div>
  );

  const fmt = (n) => {
    if (!Number.isFinite(n)) return '0';
    if (n >= 1000) return `${(n/1000).toFixed(n % 1000 === 0 ? 0 : 1)}k+`;
    return n.toString();
  };





  // Debug logging
  if (isAuthenticated) {
    console.log('Home page - Authenticated user, data:', {
      competitions: competitions?.competitions?.length,
      topShooters: topShooters?.leaderboard?.length,
      landingStats,
      competitionsError,
      shootersError,
      statsError,
    });
  }

  return (
    <div className="space-y-12">
      {/* Show error messages if queries fail */}
      {(competitionsError || shootersError || statsError) && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-white">
          <p className="font-semibold mb-2">Error loading data:</p>
          {competitionsError && <p className="text-sm">Competitions: {competitionsError.message}</p>}
          {shootersError && <p className="text-sm">Leaderboard: {shootersError.message}</p>}
          {statsError && <p className="text-sm">Stats: {statsError.message}</p>}
        </div>
      )}
      <MobileAuthCta />
      {/* Hero Section with Banner */}
      <section className="relative overflow-hidden rounded-2xl">
        {/* Banner Image */}
        <div className="relative">
          <img 
            src={`${process.env.PUBLIC_URL}/TheXringClassic.png`} 
            alt="The X-Ring Classic Banner" 
            className="w-full h-auto object-cover"
          />
          
          {/* Content Overlay - Positioned in bottom section to avoid conflicts */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-8">
            <div className="text-center text-white">
              <p className="text-lg md:text-xl mb-4 drop-shadow-lg font-medium">
                The premier platform for precision .22 rifle competitions and marksmanship excellence
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/competitions"
                  className="bg-white text-gray-900 px-6 py-2 rounded-lg font-semibold hover:bg-gray-200 transition-colors shadow-lg text-sm"
                >
                  Browse Competitions
                </Link>
                <Link
                  to="/leaderboard"
                  className="border-2 border-white text-white px-6 py-2 rounded-lg font-semibold hover:bg-white hover:text-gray-900 transition-colors shadow-lg text-sm"
                >
                  View Leaderboards
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-blue-600/40 rounded-lg mx-auto mb-4">
            <TrophyIcon className="w-6 h-6 text-blue-200" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">{fmt(landingStats?.activeCompetitions ?? 0)}</h3>
          <p className="text-gray-700">Active Competitions</p>
        </div>
        <div className="card text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-green-600/40 rounded-lg mx-auto mb-4">
            <UsersIcon className="w-6 h-6 text-green-200" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">{fmt(landingStats?.totalUsers ?? 0)}</h3>
          <p className="text-gray-700">Registered Shooters</p>
        </div>
        <div className="card text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-purple-600/40 rounded-lg mx-auto mb-4">
            <ViewfinderCircleIcon className="w-6 h-6 text-purple-200" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">{fmt(landingStats?.totalScores ?? 0)}</h3>
          <p className="text-gray-700">Scores Submitted</p>
        </div>
        <div className="card text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-orange-600/40 rounded-lg mx-auto mb-4">
            <MapPinIcon className="w-6 h-6 text-orange-200" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">{fmt(landingStats?.rangesPartnered ?? 0)}</h3>
          <p className="text-gray-700">Ranges Partnered</p>
        </div>
      </section>

      {/* Featured Competitions */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-gray-100">Featured Competitions</h2>
          <Link
            to="/competitions"
            className="flex items-center space-x-2 text-gray-300 hover:text-gray-200 font-medium"
          >
            <span>View All</span>
            <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(competitions?.competitions || []).map((competition) => (
            <div key={competition.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <span className={`badge ${
                  (competition.competitionType || competition.type) === 'indoor' ? 'badge-info' : 'badge-success'
                }`}>
                  {competition.competitionType || competition.type}
                </span>
                <span className="text-sm text-gray-700">
                  {competition.maxDistance ? `${competition.maxDistance} yards` : competition.distance || 'TBD'}
                </span>
              </div>
              
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {competition.title}
              </h3>
              
              <p className="text-gray-700 mb-4 line-clamp-2">
                {competition.description}
              </p>
              
              <div className="flex items-center space-x-4 text-sm mb-4">
                <div className="flex items-center space-x-1">
                  <CalendarIcon className="w-4 h-4 text-gray-600" />
                  <span className="text-gray-900">
                    {competition.schedule?.competitionDate 
                      ? new Date(competition.schedule.competitionDate).toLocaleDateString()
                      : competition.startDate 
                      ? new Date(competition.startDate).toLocaleDateString()
                      : 'TBD'
                    }
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <MapPinIcon className="w-4 h-4 text-gray-600" />
                  <span className="text-gray-900">{competition.range?.name || competition.location || 'TBD'}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-gray-900">
                  ${competition.prizePool}
                </span>
                                  <Link
                    to={`/competitions/${competition.id}`}
                    className="btn-primary text-sm"
                  >
                  View Details
                </Link>
              </div>
            </div>
          ))}
          
          {/* Show loading placeholders when loading or no data */}
          {(competitionsLoading || !competitions?.competitions?.length) && (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-4 bg-gray-800 rounded w-1/4 mb-4"></div>
                <div className="h-6 bg-gray-800 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-800 rounded w-full mb-4"></div>
                <div className="h-4 bg-gray-800 rounded w-1/2 mb-4"></div>
                <div className="flex justify-between">
                  <div className="h-6 bg-gray-800 rounded w-1/4"></div>
                  <div className="h-8 bg-gray-800 rounded w-1/3"></div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Top Shooters */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-gray-100">Top Shooters</h2>
          <Link
            to="/leaderboard"
            className="flex items-center space-x-2 text-gray-300 hover:text-gray-200 font-medium"
          >
            <span>View Full Leaderboard</span>
            <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </div>
        
            <div className="card">
              <div className="space-y-4">
                {(topShooters?.leaderboard || []).map((shooter, index) => (
                  <div
                    key={`${shooter.competitor.id}-${index}`}
                    className={`flex items-center justify-between py-3 border-b border-red-900/40 last:border-b-0 ${getClassRowBg(shooter.competitor?.classification)}`}
                  >
                  <div className="flex items-center space-x-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 ? 'bg-yellow-500 text-yellow-900' :
                      index === 1 ? 'bg-slate-400 text-slate-900' :
                      index === 2 ? 'bg-orange-500 text-orange-900' :
                      'bg-blue-500 text-blue-900'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900">
                          {shooter.competitor.firstName} {shooter.competitor.lastName}
                        </h4>
                        {shooter.competitor.classification && (
                          <span
                            className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getClassStyles(shooter.competitor.classification)}`}
                            title={`${shooter.competitor.classification} – ${getClassDescription(shooter.competitor.classification)}`}
                            aria-label={`${shooter.competitor.classification} – ${getClassDescription(shooter.competitor.classification)}`}
                          >
                            {shooter.competitor.classification}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">@{shooter.competitor.username}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">{(shooter.bestScore ?? shooter.score)?.toFixed(1)}</div>
                    <div className="text-sm text-gray-600">
                      {(shooter.competitionsCount ?? 1)} {((shooter.competitionsCount ?? 1) === 1 ? 'competition' : 'competitions')}
                    </div>
                  </div>
                </div>
              ))}
            
            {/* Show loading placeholders when loading or no data */}
            {(shootersLoading || !topShooters?.leaderboard?.length) && (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-red-900/40 last:border-b-0 animate-pulse">
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 bg-gray-800 rounded-full"></div>
                    <div>
                      <div className="h-4 bg-gray-800 rounded w-32 mb-1"></div>
                      <div className="h-3 bg-gray-800 rounded w-20"></div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="h-4 bg-gray-800 rounded w-12 mb-1"></div>
                    <div className="h-3 bg-gray-800 rounded w-20"></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        {/* Classification Legend */}
        <div className="mt-4 bg-white rounded-lg shadow-sm border-2 border-red-800 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Classification Legend</h3>
          <div className="flex flex-wrap gap-2">
            {[
              'Grand Master',
              'Master',
              'Diamond',
              'Platinum',
              'Gold',
              'Bronze',
            ].map((cls) => (
              <div key={cls} className="flex items-center gap-2 mr-2">
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getClassStyles(cls)}`}>
                  {cls}
                </span>
                <span className="text-xs text-gray-600">{getLegendDescription(cls)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="text-center py-16 bg-white rounded-2xl border-2 border-red-800">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Ready to Compete?
        </h2>
        <p className="text-xl text-gray-700 mb-8 max-w-2xl mx-auto">
          Join thousands of precision shooters in the ultimate .22LR rifle championship platform.
          Register today and start your journey to the top of the leaderboard.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/register"
            className="btn-primary text-lg px-8 py-3"
          >
            Get Started
          </Link>
          <Link
            to="/competitions"
            className="btn-secondary text-lg px-8 py-3"
          >
            Browse Competitions
          </Link>
        </div>
      </section>

      {/* Sponsorship Hero Section - Hidden for now */}
      {false && (
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}></div>
        </div>
        
        <div className="relative px-6 py-16 sm:px-12 sm:py-20 lg:px-16">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-red-600/20 text-red-300 px-6 py-2 text-sm font-semibold tracking-wide uppercase border border-red-600/30">
              <MegaphoneIcon className="w-5 h-5" />
              <span>Partnership Opportunities</span>
            </div>

            {/* Heading */}
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
              Reach Precision Shooters with
              <span className="block text-red-400 mt-2">Strategic Sponsorship</span>
            </h2>

            {/* Description */}
            <p className="text-xl sm:text-2xl text-gray-200 max-w-3xl mx-auto leading-relaxed">
              Connect with a high-intent community of competitive marksmen, ranges, and gear enthusiasts. 
              Reserve banner placements and elevate your brand with transparent reporting and dedicated support.
            </p>

            {/* Features */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-12">
              <div className="flex flex-col items-center space-y-3 p-6 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
                <div className="w-12 h-12 bg-red-600/20 rounded-full flex items-center justify-center">
                  <CurrencyDollarIcon className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="font-semibold text-lg">Affordable Rates</h3>
                <p className="text-sm text-gray-300 text-center">Starting at $50 for 30-day placements</p>
              </div>
              
              <div className="flex flex-col items-center space-y-3 p-6 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
                <div className="w-12 h-12 bg-red-600/20 rounded-full flex items-center justify-center">
                  <ViewfinderCircleIcon className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="font-semibold text-lg">Transparent Analytics</h3>
                <p className="text-sm text-gray-300 text-center">Real-time impressions, clicks, and CTR tracking</p>
              </div>
              
              <div className="flex flex-col items-center space-y-3 p-6 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
                <div className="w-12 h-12 bg-red-600/20 rounded-full flex items-center justify-center">
                  <TrophyIcon className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="font-semibold text-lg">Dedicated Support</h3>
                <p className="text-sm text-gray-300 text-center">Account manager and creative QA included</p>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12">
              <Link
                to="/sponsorship"
                className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-colors shadow-lg hover:shadow-xl"
              >
                <span>Explore Sponsorship Options</span>
                <ArrowRightIcon className="w-5 h-5" />
              </Link>
              <a
                href="mailto:sponsorships@thexringclassic.com"
                className="inline-flex items-center justify-center gap-2 border-2 border-white/30 hover:border-white/50 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-colors backdrop-blur-sm bg-white/5 hover:bg-white/10"
              >
                <span>Contact Partnerships</span>
              </a>
            </div>

            {/* Trust Indicators */}
            <div className="mt-12 pt-8 border-t border-white/10">
              <p className="text-sm text-gray-400">
                Trusted by leading firearms brands, range operators, and equipment manufacturers
              </p>
            </div>
          </div>
        </div>
      </section>
      )}
    </div>
  );
};

export default Home;
