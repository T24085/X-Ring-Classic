import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import { competitionsAPI, leaderboardsAPI, publicAPI, scoresAPI } from '../services/api.firebase';
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
  
  const formatPrivateName = (firstName, lastName) => {
    const f = (firstName || '').trim();
    const l = (lastName || '').trim();
    if (f && l) return `${f} ${l.charAt(0).toUpperCase()}.`;
    return f || 'Shooter';
  };

  const initialsFromName = (firstName, lastName) => {
    const f = (firstName || '').trim();
    const l = (lastName || '').trim();
    const fi = f ? f.charAt(0).toUpperCase() : '';
    const li = l ? l.charAt(0).toUpperCase() : '';
    return (fi + li) || 'S';
  };

  const displayClass = (classification) =>
    (classification || '').toString().replace(/^provisional\s+/i, '').trim();

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

  // Fetch latest competition winner
  const { data: latestCompetitionWinner, isLoading: winnerLoading } = useQuery(
    ['latest-competition-winner'],
    async () => {
      try {
        // Get competitions with scores - prioritize completed/closed, then published
        // Try to fetch completed and closed first (may require auth), fallback to published
        let allCompetitions = [];
        
        // Try completed competitions first (most likely to have winners)
        try {
          const completedResp = await competitionsAPI.getAll({ status: 'completed', limit: 20 });
          allCompetitions.push(...(completedResp.data?.competitions || []));
        } catch (err) {
          console.warn('Could not fetch completed competitions:', err);
        }
        
        // Try closed competitions
        try {
          const closedResp = await competitionsAPI.getAll({ status: 'closed', limit: 20 });
          allCompetitions.push(...(closedResp.data?.competitions || []));
        } catch (err) {
          console.warn('Could not fetch closed competitions:', err);
        }
        
        // Always include published competitions
        try {
          const publishedResp = await competitionsAPI.getAll({ status: 'published', limit: 20 });
          allCompetitions.push(...(publishedResp.data?.competitions || []));
        } catch (err) {
          console.warn('Could not fetch published competitions:', err);
        }
        
        // Remove duplicates by ID
        const uniqueCompetitions = Array.from(
          new Map(allCompetitions.map(comp => [comp.id, comp])).values()
        );
        
        // Sort by competition date (most recent first)
        const competitions = uniqueCompetitions.sort((a, b) => {
          const dateA = a.schedule?.competitionDate || a.startDate || a.createdAt || 0;
          const dateB = b.schedule?.competitionDate || b.startDate || b.createdAt || 0;
          const timeA = typeof dateA === 'string' ? new Date(dateA).getTime() : 
                        (dateA?.toMillis?.() || (typeof dateA === 'object' && dateA?.seconds ? dateA.seconds * 1000 : 0) || 0);
          const timeB = typeof dateB === 'string' ? new Date(dateB).getTime() : 
                        (dateB?.toMillis?.() || (typeof dateB === 'object' && dateB?.seconds ? dateB.seconds * 1000 : 0) || 0);
          return timeB - timeA; // Most recent first
        });
        
        // Find competition with scores (most recent first)
        for (const comp of competitions) {
          try {
            const scoresResp = await scoresAPI.getByCompetition(comp.id);
            const scores = scoresResp.data?.scores || [];
            
            if (scores.length > 0) {
              // Aggregate scores by competitor (same logic as CompetitionDetail)
              const competitorMap = new Map();
              
              scores.forEach((s) => {
                const competitorId = s.competitorId || s.userId || s.id;
                const firstName = s.competitor?.firstName || s.firstName || '';
                const lastName = s.competitor?.lastName || s.lastName || '';
                const scoreValue = s.totalScore ?? s.score ?? 0;
                const xCount = typeof s.tiebreakerData?.xCount === 'number'
                  ? s.tiebreakerData.xCount
                  : Array.isArray(s.shots)
                    ? s.shots.filter((shot) => shot?.isX === true).length
                    : 0;
                const classification = s.competitor?.classification || s.classification || null;

                if (!competitorMap.has(competitorId)) {
                  competitorMap.set(competitorId, {
                    competitorId,
                    firstName,
                    lastName,
                    displayName: `${firstName} ${lastName?.charAt(0)?.toUpperCase() || ''}.`,
                    classification,
                    totalScore: 0,
                    totalXCount: 0,
                    scoreCount: 0,
                  });
                }

                const competitor = competitorMap.get(competitorId);
                competitor.totalScore += scoreValue;
                competitor.totalXCount += xCount;
                competitor.scoreCount += 1;
              });

              const aggregated = Array.from(competitorMap.values());
              aggregated.sort((a, b) => {
                if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
                return b.totalXCount - a.totalXCount;
              });

              if (aggregated.length > 0) {
                return {
                  competition: comp,
                  winner: aggregated[0],
                };
              }
            }
          } catch (err) {
            console.warn(`Failed to get scores for competition ${comp.id}:`, err);
            continue;
          }
        }
        return null;
      } catch (err) {
        console.error('Home: Latest competition winner error:', err);
        return null;
      }
    },
    { 
      staleTime: 5 * 60 * 1000, // 5 minutes
      enabled: true,
      retry: 1,
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





  return (
    <div className="relative space-y-12">
      {/* Subtle background accents to make the page feel less flat */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-red-600/20 blur-3xl" />
        <div className="absolute top-32 right-[-6rem] h-[22rem] w-[22rem] rounded-full bg-yellow-500/20 blur-3xl" />
        <div className="absolute bottom-20 left-[-6rem] h-[24rem] w-[24rem] rounded-full bg-blue-600/15 blur-3xl" />
      </div>
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

      {/* Quick Actions */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/competitions"
          className="group bg-white rounded-2xl border-2 border-red-800/70 shadow-sm hover:shadow-md transition-shadow p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Explore</div>
              <div className="text-xl font-bold text-gray-900 mt-1">Competitions</div>
              <div className="text-sm text-gray-600 mt-1">Find active matches and results</div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-600/15 flex items-center justify-center group-hover:bg-blue-600/20">
              <CalendarIcon className="w-6 h-6 text-blue-700" />
            </div>
          </div>
        </Link>

        <Link
          to="/leaderboard"
          className="group bg-white rounded-2xl border-2 border-red-800/70 shadow-sm hover:shadow-md transition-shadow p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Rankings</div>
              <div className="text-xl font-bold text-gray-900 mt-1">Leaderboards</div>
              <div className="text-sm text-gray-600 mt-1">See who’s climbing</div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-yellow-500/15 flex items-center justify-center group-hover:bg-yellow-500/20">
              <TrophyIcon className="w-6 h-6 text-yellow-700" />
            </div>
          </div>
        </Link>

        <Link
          to={isAuthenticated ? "/profile" : "/login"}
          className="group bg-white rounded-2xl border-2 border-red-800/70 shadow-sm hover:shadow-md transition-shadow p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Performance</div>
              <div className="text-xl font-bold text-gray-900 mt-1">{isAuthenticated ? 'Your Stats' : 'Sign In'}</div>
              <div className="text-sm text-gray-600 mt-1">{isAuthenticated ? 'Shot-level analytics and trends' : 'Access your profile & stats'}</div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-600/15 flex items-center justify-center group-hover:bg-purple-600/20">
              <ViewfinderCircleIcon className="w-6 h-6 text-purple-700" />
            </div>
          </div>
        </Link>
      </section>

      {/* Latest Competition Winner */}
      {latestCompetitionWinner && latestCompetitionWinner.winner && (
        <section className="relative overflow-hidden rounded-3xl border-2 border-yellow-400 bg-gradient-to-r from-yellow-50 via-yellow-100 to-yellow-50 shadow-xl">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, rgba(250, 204, 21, .55), transparent 45%), radial-gradient(circle at 80% 30%, rgba(234, 179, 8, .35), transparent 40%)",
            }}
          />
          <div className="relative p-8 sm:p-10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-600/15 text-yellow-800 border border-yellow-600/25 text-xs font-semibold uppercase tracking-wide">
                  <TrophyIcon className="w-4 h-4" />
                  Latest Winner
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mt-4">
                  {latestCompetitionWinner.winner.displayName}
                </h2>
                <p className="text-gray-700 mt-2 text-lg">{latestCompetitionWinner.competition.title}</p>

                {latestCompetitionWinner.winner.classification && (
                  <div className="mt-4">
                    <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getClassStyles(latestCompetitionWinner.winner.classification)}`}>
                      {displayClass(latestCompetitionWinner.winner.classification)}
                    </span>
                  </div>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    to={`/competitions/${latestCompetitionWinner.competition.id}`}
                    className="inline-flex items-center justify-center px-6 py-2.5 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 transition-colors shadow"
                  >
                    View Competition Results
                  </Link>
                  <Link
                    to="/competitions"
                    className="inline-flex items-center justify-center px-6 py-2.5 bg-white/80 text-gray-900 rounded-lg font-semibold hover:bg-white transition-colors border border-yellow-600/30"
                  >
                    Browse Competitions
                  </Link>
                </div>
              </div>

              <div className="flex-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-yellow-600/15">
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Total Score</div>
                    <div className="text-3xl font-extrabold text-gray-900 mt-1">
                      {latestCompetitionWinner.winner.totalScore.toFixed(1)}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">Across submitted scorecards</div>
                  </div>
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-yellow-600/15">
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Total X Count</div>
                    <div className="text-3xl font-extrabold text-gray-900 mt-1">
                      {latestCompetitionWinner.winner.totalXCount}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">Perfect shots (X)</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

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
        
            <div className="bg-white rounded-2xl border-2 border-red-800 shadow-sm p-6">
              {(() => {
                const lb = topShooters?.leaderboard || [];
                const podium = lb.slice(0, 3);
                const rest = lb.slice(3);

                const medalBg = (i) => (
                  i === 0 ? 'bg-yellow-500 text-yellow-900' :
                  i === 1 ? 'bg-slate-400 text-slate-900' :
                  'bg-orange-500 text-orange-900'
                );

                return (
                  <>
                    {podium.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        {podium.map((shooter, i) => {
                          const c = shooter.competitor || {};
                          const name = formatPrivateName(c.firstName, c.lastName);
                          const initials = initialsFromName(c.firstName, c.lastName);
                          const score = (shooter.bestScore ?? shooter.score)?.toFixed(1);
                          return (
                            <div
                              key={`${c.id || i}-podium`}
                              className={`rounded-2xl border p-5 shadow-sm ${i === 0 ? 'border-yellow-500/50 bg-yellow-50' : 'border-gray-200 bg-gray-50'}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-extrabold ${medalBg(i)}`}>
                                  {i + 1}
                                </div>
                                <div className="text-xs font-semibold text-gray-600">
                                  {(shooter.competitionsCount ?? 1)} {(shooter.competitionsCount ?? 1) === 1 ? 'competition' : 'competitions'}
                                </div>
                              </div>
                              <div className="mt-4 flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-white border flex items-center justify-center font-extrabold text-gray-800">
                                  {initials}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <div className="font-bold text-gray-900 truncate">{name}</div>
                                    {c.classification && (
                                      <span
                                        className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getClassStyles(c.classification)}`}
                                        title={`${displayClass(c.classification)} – ${getClassDescription(c.classification)}`}
                                      >
                                        {displayClass(c.classification)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-600 mt-1">
                                    Best: <span className="font-semibold text-gray-900">{score}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="space-y-2">
                      {rest.map((shooter, idx) => {
                        const rank = idx + 4;
                        const c = shooter.competitor || {};
                        const name = formatPrivateName(c.firstName, c.lastName);
                        const score = (shooter.bestScore ?? shooter.score)?.toFixed(1);
                        return (
                          <div
                            key={`${c.id || rank}-row`}
                            className={`flex items-center justify-between rounded-xl px-4 py-3 border border-gray-200 ${getClassRowBg(c.classification)}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-600/15 text-blue-800 flex items-center justify-center text-sm font-extrabold">
                                {rank}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className="font-semibold text-gray-900 truncate">{name}</div>
                                  {c.classification && (
                                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getClassStyles(c.classification)}`}>
                                      {displayClass(c.classification)}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-600">
                                  {(shooter.competitionsCount ?? 1)} {(shooter.competitionsCount ?? 1) === 1 ? 'competition' : 'competitions'}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-gray-900">{score}</div>
                              <div className="text-xs text-gray-600">Best score</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {(shootersLoading || !topShooters?.leaderboard?.length) && (
                      <div className="mt-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="flex items-center justify-between py-3 border-b border-gray-200 last:border-b-0 animate-pulse">
                            <div className="flex items-center space-x-4">
                              <div className="w-10 h-10 bg-gray-200 rounded-xl"></div>
                              <div>
                                <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                                <div className="h-3 bg-gray-200 rounded w-20"></div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="h-4 bg-gray-200 rounded w-12 mb-2"></div>
                              <div className="h-3 bg-gray-200 rounded w-20"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
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
