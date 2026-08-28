import React from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { competitionsAPI } from '../services/api.firebase';
import {
  ArrowUpRight,
  Calendar,
  Clock,
  Home as HomeIcon,
  MapPin,
  Target,
  TreePine,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';

const getCompetitionDate = (competition) => {
  const rawDate = competition.schedule?.competitionDate || competition.startDate || competition.createdAt;
  if (!rawDate) return null;

  const date = rawDate?.toDate?.()
    || (rawDate?.toMillis ? new Date(rawDate.toMillis()) : null)
    || (rawDate?.seconds ? new Date(rawDate.seconds * 1000) : null)
    || new Date(rawDate);

  return Number.isNaN(date.getTime()) ? null : date;
};

const getTypeIcon = (competition) => {
  const type = competition.competitionType || competition.type;
  switch (type) {
    case 'indoor': return HomeIcon;
    case 'outdoor': return TreePine;
    case 'precision': return Target;
    case 'speed': return Zap;
    default: return Trophy;
  }
};

const formatStatus = (status) => {
  if (!status) return 'Scheduled';
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const CompetitionCard = ({ competition, isPast = false, onViewDetails, onRegister, isRegistering }) => {
  const date = getCompetitionDate(competition);
  const TypeIcon = getTypeIcon(competition);
  const month = date?.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() || 'TBD';
  const day = date ? date.getDate() : '—';
  const fullDate = date
    ? date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : 'Date to be announced';
  const totalShots = competition.totalShots || ((competition.shotsPerTarget || 0) * (competition.targetCount || 4)) || null;
  const participantLimit = competition.maxParticipants ? ` / ${competition.maxParticipants}` : '';

  return (
    <article className={`group relative flex min-h-[390px] flex-col overflow-hidden rounded-[1.35rem] border shadow-[0_18px_45px_rgba(0,0,0,0.24)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_60px_rgba(0,0,0,0.38)] ${
      isPast
        ? 'border-white/10 bg-[#171a22]/90'
        : 'border-white/15 bg-[#10141d]/95 hover:border-red-400/50'
    }`}
    >
      <div className="h-1 bg-gradient-to-r from-[#9b1c1c] via-[#d7a84f] to-[#9b1c1c]" />

      <div className="relative overflow-hidden px-5 pb-5 pt-5">
        <div className="pointer-events-none absolute -right-8 -top-12 h-32 w-32 rounded-full bg-red-500/10 blur-2xl transition-colors duration-300 group-hover:bg-red-400/20" />
        <div className="relative flex items-start gap-3">
          <div className="flex h-[76px] w-[64px] shrink-0 flex-col items-center justify-center rounded-xl border border-[#d7a84f]/35 bg-gradient-to-b from-[#2a2020] to-[#17161a] shadow-inner">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d7a84f]">{month}</span>
            <span className="mt-0.5 text-3xl font-black leading-none text-white">{day}</span>
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
                <TypeIcon className="h-3.5 w-3.5 shrink-0 text-[#d7a84f]" />
                <span className="truncate">X-Ring Classic</span>
              </div>
              <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${
                isPast
                  ? 'border-white/15 bg-white/5 text-white/55'
                  : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
              }`}>
                {formatStatus(competition.status)}
              </span>
            </div>
            <h3 className="line-clamp-3 text-base font-bold leading-tight text-white transition-colors group-hover:text-[#f0c66c]">
              {competition.title || 'X-Ring Competition'}
            </h3>
            <p className="mt-2 text-xs font-medium text-white/55">{fullDate}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col border-t border-white/10 px-5 py-4">
        <p className="line-clamp-2 min-h-[40px] text-sm leading-relaxed text-white/65">
          {competition.description || 'Precision .22 rifle competition built for focused shooting and measurable results.'}
        </p>

        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-[#d7a84f]" />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">{competition.range?.name || competition.location || 'TBD'}</p>
              <p className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-white/40">Range</p>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <Users className="h-4 w-4 shrink-0 text-[#d7a84f]" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white">{competition.participantCount || competition.registeredCount || 0}{participantLimit}</p>
              <p className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-white/40">Shooters</p>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <Target className="h-4 w-4 shrink-0 text-[#d7a84f]" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white">{totalShots ? `${totalShots} shots` : 'TBD'}</p>
              <p className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-white/40">Course</p>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <Clock className="h-4 w-4 shrink-0 text-[#d7a84f]" />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">{competition.duration || 'TBD'}</p>
              <p className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-white/40">Duration</p>
            </div>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Prize pool</p>
            <p className="mt-0.5 text-base font-bold text-[#f0c66c]">${competition.prizePool || 0}</p>
          </div>
          <Calendar className="h-5 w-5 text-white/20" />
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onViewDetails}
            className="inline-flex min-h-[42px] min-w-0 flex-1 items-center justify-center gap-1 rounded-xl border border-white/20 bg-white/[0.06] px-2 py-2.5 text-center text-[11px] font-bold uppercase leading-tight tracking-[0.06em] text-white transition-all hover:border-white/40 hover:bg-white/[0.12] sm:gap-2 sm:px-3 sm:text-xs sm:tracking-[0.08em]"
          >
            {isPast ? 'View Results' : 'View Details'}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
          {!isPast && competition.status === 'published' && (
            <button
              type="button"
              onClick={onRegister}
              disabled={isRegistering}
              className="inline-flex min-h-[42px] min-w-0 flex-1 items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-[#b8842d] to-[#d7a84f] px-2 py-2.5 text-center text-[11px] font-bold uppercase leading-tight tracking-[0.06em] text-[#17120b] shadow-[0_8px_20px_rgba(215,168,79,0.2)] transition-all hover:from-[#d19a35] hover:to-[#edc66f] disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:px-3 sm:text-xs sm:tracking-[0.08em]"
            >
              {isRegistering ? 'Registering...' : 'Register'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
};

const FeaturedCompetitionCard = ({ competition, onViewDetails, onRegister, isRegistering }) => {
  const date = getCompetitionDate(competition);
  const TypeIcon = getTypeIcon(competition);
  const fullDate = date
    ? date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : 'Date to be announced';
  const totalShots = competition.totalShots || ((competition.shotsPerTarget || 0) * (competition.targetCount || 4)) || null;
  const participantLimit = competition.maxParticipants ? ` / ${competition.maxParticipants}` : '';

  return (
    <article className="group relative overflow-hidden rounded-[1.6rem] border border-red-400/35 bg-gradient-to-br from-[#19151a] via-[#11151d] to-[#0d1118] shadow-[0_24px_70px_rgba(0,0,0,0.38)] transition-all duration-500 hover:-translate-y-1 hover:border-red-300/60 hover:shadow-[0_30px_85px_rgba(0,0,0,0.5)] motion-reduce:transition-none">
      <div className="h-1.5 bg-gradient-to-r from-[#8e171b] via-[#e1b553] to-[#8e171b]" />
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-red-500/15 blur-3xl transition-transform duration-700 group-hover:scale-125 motion-reduce:transition-none" />

      <div className="relative grid gap-6 px-6 pb-6 pt-6 md:grid-cols-[minmax(0,1fr)_9rem] md:items-center md:px-8 md:pb-7 md:pt-7">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-red-200">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.9)]" />
              Next match
            </span>
            <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">
              <TypeIcon className="h-3.5 w-3.5 text-[#d7a84f]" />
              X-Ring Classic
            </span>
          </div>

          <h3 className="mt-4 max-w-2xl text-2xl font-black leading-tight tracking-[-0.02em] text-white md:text-3xl">
            {competition.title || 'X-Ring Competition'}
          </h3>
          <p className="mt-2 text-sm font-medium text-[#f0c66c]">{fullDate}</p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/65">
            {competition.description || 'Precision .22 rifle competition built for focused shooting and measurable results.'}
          </p>

          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3 text-xs text-white/75">
            <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-[#d7a84f]" />{competition.range?.name || competition.location || 'TBD'}</span>
            <span className="inline-flex items-center gap-2"><Users className="h-4 w-4 text-[#d7a84f]" />{competition.participantCount || competition.registeredCount || 0}{participantLimit} shooters</span>
            <span className="inline-flex items-center gap-2"><Target className="h-4 w-4 text-[#d7a84f]" />{totalShots ? `${totalShots} shots` : 'Course TBD'}</span>
            <span className="inline-flex items-center gap-2"><Clock className="h-4 w-4 text-[#d7a84f]" />{competition.duration || 'TBD'}</span>
          </div>
        </div>

        <div className="relative mx-auto flex h-36 w-36 flex-col items-center justify-center rounded-[1.75rem] border border-[#d7a84f]/45 bg-gradient-to-b from-[#382821] to-[#16151a] shadow-[inset_0_0_35px_rgba(215,168,79,0.08),0_18px_35px_rgba(0,0,0,0.3)] md:mx-0 md:h-40 md:w-36">
          <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#d7a84f]">{date?.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() || 'TBD'}</span>
          <span className="mt-1 text-6xl font-black leading-none text-white">{date?.getDate() || '—'}</span>
          <span className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">{date?.toLocaleDateString('en-US', { weekday: 'short' }) || 'Date'}</span>
        </div>
      </div>

      <div className="relative flex flex-wrap items-center justify-between gap-4 border-t border-white/10 bg-black/15 px-6 py-4 md:px-8">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">Prize pool</p>
          <p className="mt-1 text-lg font-black text-[#f0c66c]">${competition.prizePool || 0}</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <button
            type="button"
            onClick={onViewDetails}
            className="inline-flex min-h-[44px] min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/[0.06] px-4 py-2.5 text-xs font-bold uppercase tracking-[0.08em] text-white transition-colors hover:border-white/45 hover:bg-white/[0.12] sm:flex-none"
          >
            View Details
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
          {competition.status === 'published' && (
            <button
              type="button"
              onClick={onRegister}
              disabled={isRegistering}
              className="inline-flex min-h-[44px] min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#b8842d] to-[#d7a84f] px-4 py-2.5 text-xs font-bold uppercase tracking-[0.08em] text-[#17120b] shadow-[0_8px_20px_rgba(215,168,79,0.2)] transition-colors hover:from-[#d19a35] hover:to-[#edc66f] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              {isRegistering ? 'Registering...' : 'Register'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
};

const Competitions = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch active competitions (published)
  const { data: activeCompetitions, isLoading: activeLoading } = useQuery(
    ['competitions-active'],
    async () => {
      const publishedResp = await competitionsAPI.getAll({ status: 'published', limit: 50 }).catch(() => ({ data: { competitions: [] } }));
      const allActive = [...(publishedResp.data?.competitions || [])];
      
      // Remove duplicates and sort by date
      const unique = Array.from(new Map(allActive.map(c => [c.id, c])).values());
      unique.sort((a, b) => {
        const dateA = a.schedule?.competitionDate || a.startDate || a.createdAt || 0;
        const dateB = b.schedule?.competitionDate || b.startDate || b.createdAt || 0;
        const timeA = typeof dateA === 'string' ? new Date(dateA).getTime() : 
                      (dateA?.toMillis?.() || (typeof dateA === 'object' && dateA?.seconds ? dateA.seconds * 1000 : 0) || 0);
        const timeB = typeof dateB === 'string' ? new Date(dateB).getTime() : 
                      (dateB?.toMillis?.() || (typeof dateB === 'object' && dateB?.seconds ? dateB.seconds * 1000 : 0) || 0);
        return timeA - timeB; // Earliest first
      });
      
      return { data: { competitions: unique } };
    },
    {
      staleTime: 5 * 60 * 1000,
    }
  );

  // Fetch completed competitions
  const { data: pastCompetitions, isLoading: pastLoading } = useQuery(
    ['competitions-past'],
    async () => {
      const completedResp = await competitionsAPI.getAll({ status: 'completed', limit: 50 }).catch(() => ({ data: { competitions: [] } }));
      const allPast = [...(completedResp.data?.competitions || [])];
      
      // Remove duplicates and sort by date (most recent first)
      const unique = Array.from(new Map(allPast.map(c => [c.id, c])).values());
      unique.sort((a, b) => {
        const dateA = a.schedule?.competitionDate || a.startDate || a.createdAt || 0;
        const dateB = b.schedule?.competitionDate || b.startDate || b.createdAt || 0;
        const timeA = typeof dateA === 'string' ? new Date(dateA).getTime() : 
                      (dateA?.toMillis?.() || (typeof dateA === 'object' && dateA?.seconds ? dateA.seconds * 1000 : 0) || 0);
        const timeB = typeof dateB === 'string' ? new Date(dateB).getTime() : 
                      (dateB?.toMillis?.() || (typeof dateB === 'object' && dateB?.seconds ? dateB.seconds * 1000 : 0) || 0);
        return timeB - timeA; // Most recent first
      });
      
      return { data: { competitions: unique } };
    },
    {
      staleTime: 5 * 60 * 1000,
    }
  );

  const isLoading = activeLoading || pastLoading;
  const error = null; // Handle errors individually if needed

  const registerMutation = useMutation(
    (competitionId) => competitionsAPI.register(competitionId),
    {
      onSuccess: () => {
        toast.success('Successfully registered for competition!');
        queryClient.invalidateQueries(['competitions']);
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to register for competition');
      },
    }
  );

  const activeCompetitionList = activeCompetitions?.data?.competitions || [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const featuredCompetition = activeCompetitionList.find((competition) => {
    const date = getCompetitionDate(competition);
    return date && date >= today;
  }) || activeCompetitionList[0];
  const supportingCompetitions = featuredCompetition
    ? activeCompetitionList.filter((competition) => competition.id !== featuredCompetition.id)
    : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    console.error('Competitions error:', error);
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-4">Error loading competitions: {error.message}</div>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Competitions Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Active Competitions</h2>
          <p className="text-gray-700 text-sm">
            {(activeCompetitions?.data?.competitions || []).length} competition{(activeCompetitions?.data?.competitions || []).length !== 1 ? 's' : ''}
          </p>
        </div>

        {activeLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : activeCompetitionList.length > 0 ? (
          <div className="space-y-5">
            {featuredCompetition && (
              <FeaturedCompetitionCard
                competition={featuredCompetition}
                onViewDetails={() => navigate(`/competitions/${featuredCompetition.id}`)}
                onRegister={() => registerMutation.mutate(featuredCompetition.id)}
                isRegistering={registerMutation.isLoading}
              />
            )}

            {supportingCompetitions.length > 0 && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-gray-700">More matches</h3>
                  <span className="text-xs text-gray-500">{supportingCompetitions.length} scheduled</span>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3 sm:gap-5">
                  {supportingCompetitions.map((competition) => (
                    <CompetitionCard
                      key={competition.id}
                      competition={competition}
                      onViewDetails={() => navigate(`/competitions/${competition.id}`)}
                      onRegister={() => registerMutation.mutate(competition.id)}
                      isRegistering={registerMutation.isLoading}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm border">
            <div className="text-gray-600 mb-4">
              <Trophy className="h-16 w-16 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No active competitions</h3>
            <p className="text-gray-600">Check back later for new competitions.</p>
          </div>
        )}
      </div>

      {/* Completed/Closed Competitions Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Past Competitions</h2>
          <p className="text-gray-700 text-sm">
            {(pastCompetitions?.data?.competitions || []).length} competition{(pastCompetitions?.data?.competitions || []).length !== 1 ? 's' : ''}
          </p>
        </div>

        {pastLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (pastCompetitions?.data?.competitions || []).length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3 sm:gap-5">
            {(pastCompetitions.data.competitions || []).map((competition) => (
              <CompetitionCard
                key={competition.id}
                competition={competition}
                isPast
                onViewDetails={() => navigate(`/competitions/${competition.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm border opacity-90">
            <div className="text-gray-600 mb-4">
              <Trophy className="h-16 w-16 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No past competitions</h3>
            <p className="text-gray-600">Past competitions will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Competitions;
