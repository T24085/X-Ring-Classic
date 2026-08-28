import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import { competitionsAPI, leaderboardsAPI, publicAPI, scoresAPI } from '../services/api.firebase';
import RankLogo from '../components/RankLogo';
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  MapPinIcon,
  TrophyIcon,
  ViewfinderCircleIcon,
} from '@heroicons/react/24/outline';

const publicPath = process.env.PUBLIC_URL || '';

const cleanText = (value) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return /^[.\s]+$/.test(trimmed) ? '' : trimmed;
};

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.toMillis === 'function') return new Date(value.toMillis());
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getCompetitionDate = (competition) => (
  competition?.schedule?.competitionDate
  || competition?.startDate
  || competition?.date
  || competition?.createdAt
);

const dateParts = (competition) => {
  const date = toDate(getCompetitionDate(competition));
  if (!date) return { month: 'TBD', day: '--', weekday: 'Date TBD', full: 'Date TBD' };

  return {
    month: date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase(),
    day: date.toLocaleDateString(undefined, { day: 'numeric' }),
    weekday: date.toLocaleDateString(undefined, { weekday: 'long' }),
    full: date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }),
  };
};

const formatScore = (value) => {
  const score = Number(value);
  return Number.isFinite(score) ? score.toFixed(1) : '—';
};

const formatCount = (value) => {
  const count = Number(value);
  if (!Number.isFinite(count)) return '0';
  if (count >= 1000) return `${(count / 1000).toFixed(count % 1000 === 0 ? 0 : 1)}k+`;
  return count.toString();
};

const formatShooterName = (person = {}) => {
  const displayName = cleanText(person.displayName);
  const firstName = cleanText(person.firstName);
  const lastName = cleanText(person.lastName);
  const username = cleanText(person.username);
  const emailName = cleanText(person.email?.split('@')[0]);

  if (displayName) return displayName;
  if (firstName && lastName) return `${firstName} ${lastName.charAt(0).toUpperCase()}.`;
  return firstName || username || emailName || 'Competitor';
};

const classificationLabel = (classification) => cleanText(classification)
  .replace(/^provisional\s+/i, '') || 'Classification pending';

const competitionList = (response) => response?.data?.competitions || [];

const loadLatestWinner = async () => {
  const collected = [];

  for (const status of ['completed', 'closed', 'published']) {
    try {
      const response = await competitionsAPI.getAll({ status, limit: 20 });
      collected.push(...competitionList(response));
    } catch (error) {
      console.warn(`Home editorial: unable to load ${status} competitions`, error);
    }
  }

  const uniqueCompetitions = Array.from(new Map(collected.map((competition) => [competition.id, competition])).values());
  uniqueCompetitions.sort((a, b) => {
    const first = toDate(getCompetitionDate(a))?.getTime() || 0;
    const second = toDate(getCompetitionDate(b))?.getTime() || 0;
    return second - first;
  });

  for (const competition of uniqueCompetitions) {
    try {
      const response = await scoresAPI.getByCompetition(competition.id);
      const scores = response?.data?.scores || [];
      if (!scores.length) continue;

      const competitors = new Map();
      scores.forEach((score) => {
        const competitor = score.competitor || {};
        const competitorId = score.competitorId || score.userId || score.id;
        const current = competitors.get(competitorId) || {
          ...competitor,
          firstName: competitor.firstName || score.firstName || '',
          lastName: competitor.lastName || score.lastName || '',
          displayName: competitor.displayName || score.displayName || '',
          username: competitor.username || score.username || '',
          classification: competitor.classification || score.classification || '',
          totalScore: 0,
          totalXCount: 0,
        };
        current.totalScore += Number(score.totalScore ?? score.score ?? 0) || 0;
        current.totalXCount += typeof score.tiebreakerData?.xCount === 'number'
          ? score.tiebreakerData.xCount
          : Array.isArray(score.shots) ? score.shots.filter((shot) => shot?.isX === true).length : 0;
        competitors.set(competitorId, current);
      });

      const winner = Array.from(competitors.values()).sort((a, b) => (
        b.totalScore - a.totalScore || b.totalXCount - a.totalXCount
      ))[0];

      if (winner) return { competition, winner };
    } catch (error) {
      console.warn(`Home editorial: unable to load scores for ${competition.id}`, error);
    }
  }

  return null;
};

const SectionHeading = ({ eyebrow, title, linkLabel, linkTo }) => (
  <div className="home-editorial-heading">
    <div>
      <p className="home-eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
    </div>
    {linkLabel && linkTo && (
      <Link className="home-text-link" to={linkTo}>
        {linkLabel}
        <ArrowRightIcon className="h-4 w-4" />
      </Link>
    )}
  </div>
);

const StatRail = ({ stats }) => {
  const items = [
    { label: 'Active matches', value: formatCount(stats?.activeCompetitions), accent: 'red' },
    { label: 'Registered shooters', value: formatCount(stats?.totalUsers), accent: 'blue' },
    { label: 'Approved scorecards', value: formatCount(stats?.totalScores), accent: 'gold' },
    { label: 'Partner ranges', value: formatCount(stats?.rangesPartnered), accent: 'silver' },
  ];

  return (
    <section className="home-stat-rail" aria-label="Platform statistics">
      {items.map((item) => (
        <div className="home-stat" key={item.label}>
          <span className={`home-stat-mark home-stat-mark--${item.accent}`} />
          <div>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </div>
        </div>
      ))}
    </section>
  );
};

const MatchMeta = ({ competition, compact = false }) => {
  const date = dateParts(competition);
  const range = competition?.range?.name || competition?.location || 'Range TBD';
  const shots = competition?.totalShots || competition?.shots || 100;

  return (
    <div className={`home-match-meta${compact ? ' home-match-meta--compact' : ''}`}>
      <span><CalendarDaysIcon className="h-4 w-4" />{date.full}</span>
      <span><MapPinIcon className="h-4 w-4" />{range}</span>
      <span><ViewfinderCircleIcon className="h-4 w-4" />{shots} shots</span>
    </div>
  );
};

const CompetitionCard = ({ competition }) => {
  const date = dateParts(competition);
  const type = competition?.competitionType || competition?.type || 'precision match';

  return (
    <Link to={`/competitions/${competition.id}`} className="home-competition-card group">
      <div className="home-competition-date">
        <span>{date.month}</span>
        <strong>{date.day}</strong>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center gap-2">
          <span className="home-card-kicker">{type}</span>
          {competition.status && <span className="home-status-dot">{competition.status}</span>}
        </div>
        <h3>{competition.title || 'X-Ring Classic Match'}</h3>
        <p>{competition.description || 'Precision .22 rifle competition.'}</p>
        <MatchMeta competition={competition} compact />
      </div>
      <ArrowRightIcon className="home-card-arrow h-5 w-5 shrink-0" />
    </Link>
  );
};

const ShooterMark = ({ shooter, rank }) => {
  const competitor = shooter?.competitor || shooter || {};
  return (
    <div className="home-shooter-mark" aria-label={`${formatShooterName(competitor)} rank ${rank}`}>
      {competitor.classification ? (
        <RankLogo classification={competitor.classification} size={44} className="h-11 w-11" />
      ) : (
        <span>#{rank}</span>
      )}
    </div>
  );
};

const HomeEditorial = () => {
  const { isAuthenticated } = useAuth();

  const { data: competitionResponse, isLoading: competitionsLoading, error: competitionsError } = useQuery(
    ['editorial-home-competitions'],
    () => competitionsAPI.getAll({ status: 'published', limit: 12 }),
    { staleTime: 5 * 60 * 1000, retry: 2 }
  );
  const { data: leaderboardResponse, isLoading: shootersLoading, error: shootersError } = useQuery(
    ['editorial-home-leaderboard'],
    () => leaderboardsAPI.getOverall({ limit: 5 }),
    { staleTime: 10 * 60 * 1000, retry: 2 }
  );
  const { data: stats, error: statsError } = useQuery(
    ['editorial-home-stats'],
    () => publicAPI.getStats(),
    { staleTime: 2 * 60 * 1000, retry: 2 }
  );
  const { data: latestWinner, isLoading: winnerLoading } = useQuery(
    ['editorial-home-latest-winner'],
    loadLatestWinner,
    { staleTime: 5 * 60 * 1000, retry: 1 }
  );

  const competitions = useMemo(() => competitionList(competitionResponse), [competitionResponse]);
  const leaderboard = leaderboardResponse?.data?.leaderboard || [];
  const now = Date.now();
  const nextMatch = useMemo(() => (
    competitions
      .filter((competition) => {
        const date = toDate(getCompetitionDate(competition));
        return date && date.getTime() >= now;
      })
      .sort((a, b) => (toDate(getCompetitionDate(a))?.getTime() || 0) - (toDate(getCompetitionDate(b))?.getTime() || 0))[0] || null
  ), [competitions, now]);
  const otherCompetitions = useMemo(() => (
    competitions.filter((competition) => competition.id !== nextMatch?.id).slice(0, 3)
  ), [competitions, nextMatch]);
  const queryError = competitionsError || shootersError || statsError;

  return (
    <div className="home-editorial">
      <div className="home-editorial-orbit home-editorial-orbit--one" />
      <div className="home-editorial-orbit home-editorial-orbit--two" />

      {queryError && (
        <div className="home-editorial-alert" role="status">
          Some live competition data is unavailable right now. You can still browse the public sections below.
        </div>
      )}

      <section className="home-editorial-hero home-reveal">
        <div className="home-hero-brand">
          <div className="home-hero-brand-copy">
            <p className="home-eyebrow home-eyebrow--bright">The X-Ring Classic</p>
            <span>Precision in every round</span>
          </div>
          <img
            src={`${publicPath}/x-ring-classic-logo.png`}
            alt="The X-Ring Classic"
            className="home-hero-logo"
          />
          <div className="home-hero-brand-index" aria-hidden="true">01 <span>/</span> 04</div>
        </div>
        <div className="home-hero-grid">
          <div className="home-hero-copy">
            <p className="home-hero-kicker">Competition starts here</p>
            <h1>Every round counts.</h1>
            <p className="home-hero-lede">
              Compete, climb, and prove your marksmanship across the .22 rifle community built for serious shooters.
            </p>
            <div className="home-hero-actions">
              <Link to={nextMatch ? `/competitions/${nextMatch.id}` : '/competitions'} className="home-button home-button--primary">
                {nextMatch ? 'Enter the next match' : 'Browse competitions'}
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link to="/leaderboard" className="home-button home-button--quiet">View the leaderboard</Link>
            </div>
          </div>

          <div className="home-next-match home-reveal home-reveal--delay" aria-live="polite">
            <div className="home-next-match-topline">
              <span className="home-live-indicator"><span />Next match</span>
              <span className="home-card-kicker">X-Ring Classic</span>
            </div>
            {nextMatch ? (
              <>
                <div className="home-next-date">
                  <span>{dateParts(nextMatch).month}</span>
                  <strong>{dateParts(nextMatch).day}</strong>
                  <small>{dateParts(nextMatch).weekday}</small>
                </div>
                <h2>{nextMatch.title || 'X-Ring Classic Match'}</h2>
                <p>{nextMatch.description || 'A precision .22 rifle match built for focused, repeatable performance.'}</p>
                <MatchMeta competition={nextMatch} />
                <Link to={`/competitions/${nextMatch.id}`} className="home-next-link">
                  See match details <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </>
            ) : (
              <div className="home-next-empty">
                <ClockIcon className="h-8 w-8" />
                <h2>The next round is almost ready.</h2>
                <p>Browse the competition calendar and be first on the line when the next match opens.</p>
                <Link to="/competitions" className="home-next-link">Open the calendar <ArrowRightIcon className="h-4 w-4" /></Link>
              </div>
            )}
          </div>
        </div>
        <div className="home-hero-footer">
          <span>Open competition · Official scorecards · Real rankings</span>
          <span>Next on the line</span>
        </div>
      </section>

      <StatRail stats={stats} />

      <section className="home-editorial-section home-proof home-reveal">
        <SectionHeading eyebrow="The standard" title="Performance, made visible" linkLabel="Full leaderboard" linkTo="/leaderboard" />
        <div className="home-proof-grid">
          <div className="home-winner-panel">
            <div className="home-panel-label"><TrophyIcon className="h-4 w-4" />Latest result</div>
            {winnerLoading ? (
              <div className="home-skeleton-stack" aria-label="Loading latest result">
                <span /><span /><span />
              </div>
            ) : latestWinner?.winner ? (
              <>
                <p className="home-result-title">Last match winner</p>
                <h3>{formatShooterName(latestWinner.winner)}</h3>
                <p className="home-result-match">{latestWinner.competition.title || 'X-Ring Classic Match'}</p>
                <div className="home-result-stats">
                  <div><strong>{formatScore(latestWinner.winner.totalScore)}</strong><span>Total score</span></div>
                  <div><strong>{latestWinner.winner.totalXCount}</strong><span>X count</span></div>
                </div>
                <Link to={`/competitions/${latestWinner.competition.id}`} className="home-text-link">View the result <ArrowRightIcon className="h-4 w-4" /></Link>
              </>
            ) : (
              <>
                <p className="home-result-title">The first result is waiting</p>
                <h3>Make your mark.</h3>
                <p className="home-result-match">Join the next competition and put your scorecard on the board.</p>
                <Link to="/register" className="home-text-link">Create your shooter profile <ArrowRightIcon className="h-4 w-4" /></Link>
              </>
            )}
          </div>

          <div className="home-leaderboard-panel">
            <div className="home-panel-label"><ViewfinderCircleIcon className="h-4 w-4" />Top of the board</div>
            {shootersLoading ? (
              <div className="home-skeleton-list" aria-label="Loading leaderboard"><span /><span /><span /></div>
            ) : leaderboard.length ? (
              <div className="home-shooter-list">
                {leaderboard.slice(0, 4).map((shooter, index) => {
                  const competitor = shooter.competitor || shooter;
                  return (
                    <div className="home-shooter-row" key={`${competitor.id || index}-${index}`}>
                      <span className="home-shooter-rank">{String(index + 1).padStart(2, '0')}</span>
                      <ShooterMark shooter={shooter} rank={index + 1} />
                      <div className="min-w-0 flex-1">
                        <strong>{formatShooterName(competitor)}</strong>
                        <span>{classificationLabel(competitor.classification)}</span>
                      </div>
                      <strong className="home-shooter-score">{formatScore(shooter.bestScore ?? shooter.score)}</strong>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="home-empty-copy">Leaderboard standings will appear as approved scorecards come in.</p>
            )}
          </div>
        </div>
      </section>

      <section className="home-editorial-section home-competitions-section home-reveal">
        <SectionHeading eyebrow="On the line" title="Upcoming competitions" linkLabel="View calendar" linkTo="/competitions" />
        {competitionsLoading ? (
          <div className="home-competition-list"><div className="home-competition-skeleton" /><div className="home-competition-skeleton" /><div className="home-competition-skeleton" /></div>
        ) : otherCompetitions.length ? (
          <div className="home-competition-list">
            {otherCompetitions.map((competition) => <CompetitionCard key={competition.id} competition={competition} />)}
          </div>
        ) : (
          <div className="home-empty-panel">
            <CalendarDaysIcon className="h-7 w-7" />
            <div><h3>No other published matches yet.</h3><p>Check the competition calendar for the latest schedule.</p></div>
            <Link to="/competitions" className="home-button home-button--quiet">Open calendar</Link>
          </div>
        )}
      </section>

      <section className="home-editorial-cta home-reveal">
        <div className="home-cta-grid-lines" />
        <div className="home-cta-content">
          <p className="home-eyebrow home-eyebrow--bright">Your place on the line</p>
          <h2>Ready to shoot for the top?</h2>
          <p>Build your profile, enter a match, and see where your score belongs.</p>
          <div className="home-hero-actions">
            <Link to={isAuthenticated ? '/profile' : '/register'} className="home-button home-button--primary">
              {isAuthenticated ? 'Open your profile' : 'Create your profile'}
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link to="/shooting-classes" className="home-button home-button--quiet">Explore classifications</Link>
          </div>
        </div>
        <div className="home-cta-badge" aria-hidden="true"><CheckCircleIcon className="h-12 w-12" /><span>CLASS<br />READY</span></div>
      </section>
    </div>
  );
};

export default HomeEditorial;
