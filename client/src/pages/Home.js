import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { competitionsAPI, leaderboardsAPI, publicAPI } from '../services/api.firebase';
import { 
  TrophyIcon, 
  CalendarIcon, 
  MapPinIcon, 
  UsersIcon,
  ArrowRightIcon,
  ViewfinderCircleIcon
} from '@heroicons/react/24/outline';

const Home = () => {
  const getClassStyles = (classification) => {
    switch ((classification || '').toLowerCase()) {
      case 'grand master':
        return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
      case 'master':
        return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
      case 'diamond':
        return 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30';
      case 'platinum':
        return 'bg-gray-800/50 text-gray-300 border border-gray-700';
      case 'gold':
        return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
      case 'bronze':
        return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
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
    switch ((classification || '').toLowerCase()) {
      case 'grand master':
        return 'bg-purple-500/10';
      case 'master':
        return 'bg-blue-500/10';
      case 'diamond':
        return 'bg-cyan-500/10';
      case 'platinum':
        return 'bg-gray-800/30';
      case 'gold':
        return 'bg-yellow-500/10';
      case 'bronze':
        return 'bg-orange-500/10';
      default:
        return 'bg-gray-900/50';
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
  const { data: competitions, isLoading: competitionsLoading } = useQuery(
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
    { staleTime: 5 * 60 * 1000 } // 5 minutes
  );

  const { data: topShooters, isLoading: shootersLoading } = useQuery(
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
    { staleTime: 10 * 60 * 1000 } // 10 minutes
  );

  // Landing stats
  const { data: landingStats } = useQuery(
    ['landing-stats'],
    () => publicAPI.getStats(),
    { staleTime: 2 * 60 * 1000 }
  );

  // Small-screen quick auth CTA
  const MobileAuthCta = () => (
      <div className="sm:hidden mb-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-300">Welcome to The X-Ring Classic</p>
          <p className="text-base font-medium text-gray-100">Sign in or create an account</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login" className="text-sm text-gray-300 hover:text-white">Login</Link>
          <Link to="/register" className="px-3 py-1 text-sm rounded-md bg-rifle-600 text-white hover:bg-rifle-700">Register</Link>
        </div>
      </div>
    </div>
  );

  const fmt = (n) => {
    if (!Number.isFinite(n)) return '0';
    if (n >= 1000) return `${(n/1000).toFixed(n % 1000 === 0 ? 0 : 1)}k+`;
    return n.toString();
  };





  return (
    <div className="space-y-12">
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
          <div className="flex items-center justify-center w-12 h-12 bg-blue-500/20 rounded-lg mx-auto mb-4">
            <TrophyIcon className="w-6 h-6 text-blue-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-100 mb-2">{fmt(landingStats?.activeCompetitions ?? 0)}</h3>
          <p className="text-gray-300">Active Competitions</p>
        </div>
        <div className="card text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-green-500/20 rounded-lg mx-auto mb-4">
            <UsersIcon className="w-6 h-6 text-green-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-100 mb-2">{fmt(landingStats?.totalUsers ?? 0)}</h3>
          <p className="text-gray-300">Registered Shooters</p>
        </div>
        <div className="card text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-purple-500/20 rounded-lg mx-auto mb-4">
            <ViewfinderCircleIcon className="w-6 h-6 text-purple-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-100 mb-2">{fmt(landingStats?.totalScores ?? 0)}</h3>
          <p className="text-gray-300">Scores Submitted</p>
        </div>
        <div className="card text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-orange-500/20 rounded-lg mx-auto mb-4">
            <MapPinIcon className="w-6 h-6 text-orange-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-100 mb-2">{fmt(landingStats?.rangesPartnered ?? 0)}</h3>
          <p className="text-gray-300">Ranges Partnered</p>
        </div>
      </section>

      {/* Featured Competitions */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-gray-100">Featured Competitions</h2>
          <Link
            to="/competitions"
            className="flex items-center space-x-2 text-rifle-600 hover:text-rifle-700 font-medium"
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
                <span className="text-sm text-gray-400">
                  {competition.maxDistance ? `${competition.maxDistance} yards` : competition.distance || 'TBD'}
                </span>
              </div>
              
              <h3 className="text-xl font-semibold text-gray-100 mb-2">
                {competition.title}
              </h3>
              
              <p className="text-gray-300 mb-4 line-clamp-2">
                {competition.description}
              </p>
              
              <div className="flex items-center space-x-4 text-sm text-gray-400 mb-4">
                <div className="flex items-center space-x-1">
                  <CalendarIcon className="w-4 h-4" />
                  <span>
                    {competition.schedule?.competitionDate 
                      ? new Date(competition.schedule.competitionDate).toLocaleDateString()
                      : competition.startDate 
                      ? new Date(competition.startDate).toLocaleDateString()
                      : 'TBD'
                    }
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <MapPinIcon className="w-4 h-4" />
                  <span>{competition.range?.name || competition.location || 'TBD'}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-gray-100">
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
            className="flex items-center space-x-2 text-rifle-600 hover:text-rifle-700 font-medium"
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
                    className={`flex items-center justify-between py-3 border-b border-gray-800 last:border-b-0 ${getClassRowBg(shooter.competitor?.classification)}`}
                  >
                  <div className="flex items-center space-x-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 ? 'bg-yellow-500/30 text-yellow-300' :
                      index === 1 ? 'bg-gray-700 text-gray-200' :
                      index === 2 ? 'bg-orange-500/30 text-orange-300' :
                      'bg-blue-500/30 text-blue-300'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-100">
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
                      <p className="text-sm text-gray-400">@{shooter.competitor.username}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-100">{(shooter.bestScore ?? shooter.score)?.toFixed(1)}</div>
                    <div className="text-sm text-gray-400">
                      {(shooter.competitionsCount ?? 1)} {((shooter.competitionsCount ?? 1) === 1 ? 'competition' : 'competitions')}
                    </div>
                  </div>
                </div>
              ))}
            
            {/* Show loading placeholders when loading or no data */}
            {(shootersLoading || !topShooters?.leaderboard?.length) && (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-gray-800 last:border-b-0 animate-pulse">
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
        <div className="mt-4 bg-gray-900 rounded-lg shadow-sm border border-gray-800 p-4">
          <h3 className="text-sm font-semibold text-gray-100 mb-3">Classification Legend</h3>
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
                <span className="text-xs text-gray-400">{getLegendDescription(cls)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="text-center py-16 bg-gray-900 rounded-2xl border border-gray-800">
        <h2 className="text-3xl font-bold text-gray-100 mb-4">
          Ready to Compete?
        </h2>
        <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
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
    </div>
  );
};

export default Home;
