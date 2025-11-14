import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { leaderboardsAPI } from '../services/api.firebase';
import { Trophy, Target, Users, Calendar } from 'lucide-react';
import RankLogo from '../components/RankLogo';

const Leaderboard = () => {
  const [selectedCategory, setSelectedCategory] = useState('overall');
  const [selectedWeaponCategory, setSelectedWeaponCategory] = useState(''); // 22LR or Airgun 22cal
  const [timeFrame, setTimeFrame] = useState('all-time');

  const { data: leaderboard, isLoading, error } = useQuery(
    ['leaderboard', selectedCategory, selectedWeaponCategory, timeFrame],
    async () => {
      try {
        let response;
        const params = { 
          timeFrame,
          ...(selectedWeaponCategory ? { category: selectedWeaponCategory } : {})
        };
        
        switch (selectedCategory) {
          case 'indoor':
            response = await leaderboardsAPI.getIndoor(params);
            break;
          case 'outdoor':
            response = await leaderboardsAPI.getOutdoor(params);
            break;
          case 'overall':
            response = await leaderboardsAPI.getOverall(params);
            break;
          default:
            response = await leaderboardsAPI.getOverall(params);
        }
        return response.data;
      } catch (err) {
        console.error('API Error:', err);
        throw err;
      }
    },
    {
      keepPreviousData: true,
      staleTime: 2 * 60 * 1000, // 2 minutes
    }
  );

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'indoor': return '🏠';
      case 'outdoor': return '🌲';
      case 'overall': return '🏆';
      default: return '🏆';
    }
  };

  const getCategoryTitle = (category) => {
    switch (category) {
      case 'indoor': return 'Indoor Leaderboard';
      case 'outdoor': return 'Outdoor Leaderboard';
      case 'overall': return 'Overall Leaderboard';
      default: return 'Leaderboard';
    }
  };

  const getMedalIcon = (position) => {
    switch (position) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return null;
    }
  };

  const getPositionColor = (position) => {
    switch (position) {
      case 1: return 'bg-yellow-50 border-yellow-200';
      case 2: return 'bg-gray-50 border-gray-200';
      case 3: return 'bg-orange-50 border-orange-200';
      default: return 'bg-white border-gray-100';
    }
  };

  // Classification styling (badge + row tint)
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
      {/* Header */}
      <div className="text-center">
        <div className="mb-6">
          <img 
            src={`${process.env.PUBLIC_URL}/TheXringClassic.png`} 
            alt="The X-Ring Classic" 
            className="h-20 w-auto mx-auto object-contain"
          />
        </div>
        <h1 className="text-3xl font-bold text-white mb-4 flex items-center justify-center drop-shadow-lg">
          <span className="mr-3">{getCategoryIcon(selectedCategory)}</span>
          {getCategoryTitle(selectedCategory)}
        </h1>
        <p className="text-white drop-shadow-md">Top performers in .22LR rifle competitions</p>
      </div>

      {/* Category and Time Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Competition Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Competition Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'overall', label: 'Overall', icon: '🏆' },
                { key: 'indoor', label: 'Indoor', icon: '🏠' },
                { key: 'outdoor', label: 'Outdoor', icon: '🌲' }
              ].map((category) => (
                <button
                  key={category.key}
                  onClick={() => setSelectedCategory(category.key)}
                  className={`p-3 rounded-lg border transition-colors ${
                    selectedCategory === category.key
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-lg mb-1">{category.icon}</div>
                    <div className="text-sm font-medium">{category.label}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Weapon Category Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Weapon Category
            </label>
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

          {/* Time Frame Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Time Frame
            </label>
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

      {/* Leaderboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Total Participants</p>
              <p className="text-xl font-bold text-gray-900">{leaderboard?.leaderboard?.length || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center">
            <Target className="h-8 w-8 text-green-600 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Average Score</p>
              <p className="text-xl font-bold text-gray-900">
                {leaderboard?.leaderboard?.length > 0 
                  ? (
                      leaderboard.leaderboard.reduce((sum, entry) => sum + (entry.averageScore ?? entry.score), 0) / leaderboard.leaderboard.length
                    ).toFixed(1)
                  : '0.0'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center">
            <Trophy className="h-8 w-8 text-yellow-600 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Top Score</p>
              <p className="text-xl font-bold text-gray-900">
                {leaderboard?.leaderboard?.length > 0 
                  ? Math.max(...leaderboard.leaderboard.map(entry => (entry.bestScore ?? entry.score))).toFixed(1)
                  : '0.0'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-purple-600 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Competitions</p>
              <p className="text-xl font-bold text-gray-900">1</p>
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Rankings</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Shooter
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Average Score</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Best Score</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">X Count</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Competitions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trend
                </th>
              </tr>
            </thead>
                         <tbody className="bg-white divide-y divide-gray-200">
               {leaderboard?.leaderboard?.map((entry, index) => (
                 <tr
                   key={`${entry.competitor.id}-${entry.rank}-${index}`}
                   className={`transition-colors ${getClassRowBg(entry.competitor?.classification)} hover:opacity-95`}
                 >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getMedalIcon(entry.rank) && (
                        <span className="text-xl mr-2">{getMedalIcon(entry.rank)}</span>
                      )}
                      <span className={`text-sm font-medium ${
                        entry.rank <= 3 ? 'text-gray-900' : 'text-gray-500'
                      }`}>
                        #{entry.rank}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center mr-3">
                        <span className="text-sm font-medium text-gray-700">
                          {entry.competitor.firstName?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                          <RankLogo classification={entry.competitor.classification} size={24} />
                          <span>
                            {entry.competitor.firstName} {entry.competitor.lastName}
                          </span>
                          {entry.competitor.classification && (
                            <span
                              className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getClassBadgeStyles(entry.competitor.classification)}`}
                              title={entry.competitor.classification}
                              aria-label={entry.competitor.classification}
                            >
                              {entry.competitor.classification}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">@{entry.competitor.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {entry.averageScore?.toFixed(1) ?? entry.score?.toFixed(1)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {(entry.bestScore ?? entry.score)?.toFixed(1)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {entry.tiebreakerData?.xCount ?? 0}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {entry.competitionsCount ?? 1}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-4 w-4 text-gray-400">—</div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {(!leaderboard?.leaderboard || leaderboard.leaderboard.length === 0) && (
          <div className="text-center py-12">
            <Trophy className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No rankings available</h3>
            <p className="text-gray-600">No scores have been submitted for this category yet.</p>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      {leaderboard?.recentActivity && leaderboard.recentActivity.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {leaderboard.recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <Trophy className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">
                    <span className="font-medium">{activity.userName}</span> scored {activity.score} in {activity.competitionName}
                  </p>
                  <p className="text-xs text-gray-500">{new Date(activity.date).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
