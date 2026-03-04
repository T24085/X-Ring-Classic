import React, { useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import { leaderboardsAPI } from '../services/api.firebase';
import { Trophy, Target, Users, Calendar } from 'lucide-react';
import RankLogo from '../components/RankLogo';

const Leaderboard = () => {
  const [selectedWeaponCategory, setSelectedWeaponCategory] = useState('');
  const [timeFrame, setTimeFrame] = useState('all-time');
  const [sortBy, setSortBy] = useState('averageScore');
  const [sortDir, setSortDir] = useState('desc');

  const { data: leaderboardData, isLoading, error } = useQuery(
    ['leaderboard', selectedWeaponCategory, timeFrame],
    async () => {
      const params = {
        timeFrame,
        ...(selectedWeaponCategory ? { category: selectedWeaponCategory } : {}),
      };
      const response = await leaderboardsAPI.getOverall(params);
      return response.data;
    },
    {
      keepPreviousData: true,
      staleTime: 2 * 60 * 1000,
    }
  );

  const leaderboard = leaderboardData?.leaderboard || [];
  const summary = leaderboardData?.summary || {};

  const getAvgXPerCard = (entry) => {
    const cards = Number(entry?.scoresCount || 0);
    if (!cards) return 0;
    return Number(entry?.totalXCount || 0) / cards;
  };

  const getSortValue = (entry, key) => {
    if (key === 'averageScore') return Number(entry?.averageScore || 0);
    if (key === 'avgXPerCard') return getAvgXPerCard(entry);
    if (key === 'totalPoints') return Number(entry?.totalPoints || entry?.score || 0);
    if (key === 'competitionsCount') return Number(entry?.competitionsCount || 0);
    if (key === 'scoresCount') return Number(entry?.scoresCount || 0);
    return 0;
  };

  const sortedLeaderboard = useMemo(() => {
    const factor = sortDir === 'asc' ? 1 : -1;
    return [...leaderboard].sort((a, b) => {
      const aValue = getSortValue(a, sortBy);
      const bValue = getSortValue(b, sortBy);
      if (aValue !== bValue) return (aValue - bValue) * factor;

      // Stable tie-breakers when selected sort value is equal.
      if ((a?.averageScore || 0) !== (b?.averageScore || 0)) {
        return ((a?.averageScore || 0) - (b?.averageScore || 0)) * factor;
      }
      return (Number(a?.totalPoints || 0) - Number(b?.totalPoints || 0)) * factor;
    });
  }, [leaderboard, sortBy, sortDir]);

  const handleSort = (key) => {
    if (sortBy === key) {
      setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setSortBy(key);
    setSortDir('desc');
  };

  const sortIndicator = (key) => {
    if (sortBy !== key) return '↕';
    return sortDir === 'desc' ? '↓' : '↑';
  };

  const getMedalIcon = (position) => {
    if (position === 1) return '🥇';
    if (position === 2) return '🥈';
    if (position === 3) return '🥉';
    return null;
  };

  const normalizeClass = (classification) =>
    (classification || '').toLowerCase().replace(/^provisional\s+/, '').trim();

  const getClassBadgeStyles = (classification) => {
    const cls = normalizeClass(classification);
    if (cls === 'grand master') return 'bg-purple-50 text-purple-700 border border-purple-200';
    if (cls === 'master') return 'bg-blue-50 text-blue-700 border border-blue-200';
    if (cls === 'diamond') return 'bg-cyan-50 text-cyan-700 border border-cyan-200';
    if (cls === 'platinum') return 'bg-gray-50 text-gray-700 border border-gray-200';
    if (cls === 'gold') return 'bg-yellow-50 text-yellow-800 border border-yellow-200';
    if (cls === 'bronze') return 'bg-orange-50 text-orange-700 border border-orange-200';
    return 'bg-gray-50 text-gray-700 border border-gray-200';
  };

  const getClassRowBg = (classification) => {
    const cls = normalizeClass(classification);
    if (cls === 'grand master') return 'bg-purple-50';
    if (cls === 'master') return 'bg-blue-50';
    if (cls === 'diamond') return 'bg-cyan-50';
    if (cls === 'platinum') return 'bg-gray-50';
    if (cls === 'gold') return 'bg-yellow-50';
    if (cls === 'bronze') return 'bg-orange-50';
    return 'bg-white';
  };

  const displayClass = (classification) =>
    (classification || '').toString().replace(/^provisional\s+/i, '').trim();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-4">Error loading leaderboard</div>
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
      <div className="text-center">
        <div className="mb-6">
          <img
            src={`${process.env.PUBLIC_URL}/TheXringClassic.png`}
            alt="The X-Ring Classic"
            className="h-20 w-auto mx-auto object-contain"
          />
        </div>
        <h1 className="text-3xl font-bold text-white mb-4 drop-shadow-lg">Competition Leaderboard</h1>
        <p className="text-white drop-shadow-md">
          Ranked by average score across all approved scorecards, with X average as tie-breaker
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Weapon Category</label>
            <select
              value={selectedWeaponCategory}
              onChange={(e) => setSelectedWeaponCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Categories</option>
              <option value="22LR">22LR</option>
              <option value="Airgun 22cal">Airgun 22cal</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Time Frame</label>
            <select
              value={timeFrame}
              onChange={(e) => setTimeFrame(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all-time">All Time</option>
              <option value="this-year">This Year</option>
              <option value="this-month">This Month</option>
              <option value="last-30-days">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Total Participants</p>
              <p className="text-xl font-bold text-gray-900">{summary.totalParticipants || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center">
            <Target className="h-8 w-8 text-green-600 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Scorecards Tracked</p>
              <p className="text-xl font-bold text-gray-900">{summary.totalScoreEntries || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center">
            <Trophy className="h-8 w-8 text-yellow-600 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Top Avg Score</p>
              <p className="text-xl font-bold text-gray-900">
                {Number(summary.topAverageScore || 0).toFixed(1)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-purple-600 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Competitions</p>
              <p className="text-xl font-bold text-gray-900">{summary.totalCompetitions || 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Rankings</h2>
        </div>

        <div className="md:hidden divide-y divide-gray-200">
          {sortedLeaderboard.map((entry, index) => (
            <div key={`m-${entry.competitor?.id || index}-${index}`} className={`p-4 ${getClassRowBg(entry.competitor?.classification)}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getMedalIcon(index + 1) && <span className="text-lg">{getMedalIcon(index + 1)}</span>}
                  <span className="font-semibold text-gray-900">#{index + 1}</span>
                </div>
                <span className="text-sm text-gray-700">{entry.competitionsCount ?? 0} comps</span>
              </div>
              <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <RankLogo classification={entry.competitor?.classification} size={20} />
                <span className="truncate">
                  {entry.competitor?.firstName} {entry.competitor?.lastName?.charAt(0)?.toUpperCase() || ''}.
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="bg-white/80 rounded p-2">
                  <p className="text-gray-600">Avg/Card</p>
                  <p className="font-semibold text-gray-900">{entry.averageScore?.toFixed(1) ?? '0.0'}</p>
                </div>
                <div className="bg-white/80 rounded p-2">
                  <p className="text-gray-600">Avg X/Card</p>
                  <p className="font-semibold text-gray-900">
                    {getAvgXPerCard(entry).toFixed(1)}
                  </p>
                </div>
                <div className="bg-white/80 rounded p-2">
                  <p className="text-gray-600">Cards</p>
                  <p className="font-semibold text-gray-900">{entry.scoresCount ?? 0}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shooter</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button type="button" onClick={() => handleSort('averageScore')} className="hover:text-gray-800">
                    Avg/Card {sortIndicator('averageScore')}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button type="button" onClick={() => handleSort('avgXPerCard')} className="hover:text-gray-800">
                    Avg X/Card {sortIndicator('avgXPerCard')}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button type="button" onClick={() => handleSort('totalPoints')} className="hover:text-gray-800">
                    Total Points {sortIndicator('totalPoints')}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button type="button" onClick={() => handleSort('competitionsCount')} className="hover:text-gray-800">
                    Competitions {sortIndicator('competitionsCount')}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button type="button" onClick={() => handleSort('scoresCount')} className="hover:text-gray-800">
                    Cards {sortIndicator('scoresCount')}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedLeaderboard.map((entry, index) => (
                <tr
                  key={`${entry.competitor?.id || index}-${index}`}
                  className={`transition-colors ${getClassRowBg(entry.competitor?.classification)} hover:opacity-95`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getMedalIcon(index + 1) && <span className="text-xl mr-2">{getMedalIcon(index + 1)}</span>}
                      <span className={`text-sm font-medium ${index + 1 <= 3 ? 'text-gray-900' : 'text-gray-500'}`}>
                        #{index + 1}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center mr-3">
                        <span className="text-sm font-medium text-gray-700">
                          {entry.competitor?.firstName?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                          <RankLogo classification={entry.competitor?.classification} size={24} />
                          <span>
                            {entry.competitor?.firstName} {entry.competitor?.lastName?.charAt(0)?.toUpperCase() || ''}.
                          </span>
                          {entry.competitor?.classification && (
                            <span
                              className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getClassBadgeStyles(entry.competitor.classification)}`}
                              title={displayClass(entry.competitor.classification)}
                              aria-label={displayClass(entry.competitor.classification)}
                            >
                              {displayClass(entry.competitor.classification)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{entry.averageScore?.toFixed(1) ?? '0.0'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {getAvgXPerCard(entry).toFixed(1)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{entry.totalPoints ?? entry.score ?? 0}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{entry.competitionsCount ?? 0}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{entry.scoresCount ?? 0}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {leaderboard.length === 0 && (
          <div className="text-center py-12">
            <Trophy className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No rankings available</h3>
            <p className="text-gray-600">No approved scores found for the selected filters.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
