import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { rangeAdminAPI, competitionsAPI, rangesAPI } from '../services/api.firebase';
import { 
  Trophy, 
  Target, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Plus,
  Edit,
  Eye,
  BarChart3
} from 'lucide-react';
import toast from 'react-hot-toast';

const RangeAdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPeriod, setSelectedPeriod] = useState('30-days');

  // Get range admin's range info
  const { data: rangeData, isLoading: rangeLoading } = useQuery(
    ['range-admin-range', user?.id],
    () => rangesAPI.getByAdminId(user?.id),
    {
      enabled: !!user?.id,
      staleTime: 10 * 60 * 1000,
    }
  );

  const range = rangeData?.data?.range;
  const rangeId = range?.id;
  const rangeName = range?.name || user?.rangeName;

  // Get dashboard stats for this range
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery(
    ['range-admin-dashboard', rangeId, selectedPeriod],
    () => rangeAdminAPI.getDashboard({ rangeId, period: selectedPeriod }),
    {
      enabled: !!rangeId,
      staleTime: 5 * 60 * 1000,
    }
  );

  // Get competitions for this range
  const { data: competitionsData, isLoading: competitionsLoading } = useQuery(
    ['range-competitions', rangeId],
    () => competitionsAPI.getByRange(rangeId),
    {
      enabled: !!rangeId,
      staleTime: 5 * 60 * 1000,
    }
  );

  // Get pending scores for this range's competitions
  const { data: pendingScoresData, isLoading: pendingScoresLoading } = useQuery(
    ['range-pending-scores', rangeId],
    () => rangeAdminAPI.getPendingScores({ rangeId }),
    {
      enabled: !!rangeId,
      staleTime: 2 * 60 * 1000,
    }
  );

  const stats = dashboardData?.stats || {};
  const competitions = competitionsData?.data?.competitions || [];
  const pendingScores = pendingScoresData?.data?.scores || [];

  if (rangeLoading || dashboardLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!range && !rangeName) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-4">No range associated with your account</div>
        <p className="text-gray-600 mb-4">Please contact an administrator to link your account to a range.</p>
        <button 
          onClick={() => navigate('/')} 
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="mb-6">
          <img 
            src={`${process.env.PUBLIC_URL}/TheXringClassic.png`} 
            alt="The X-Ring Classic" 
            className="h-20 w-auto mx-auto object-contain"
          />
        </div>
        <h1 className="text-3xl font-bold text-white drop-shadow-lg">Range Admin Dashboard</h1>
        <p className="text-white drop-shadow-md">{rangeName}</p>
      </div>
      
      <div className="flex items-center justify-between">
        <div></div>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/admin/create-competition')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Competition
          </button>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="7-days">Last 7 Days</option>
            <option value="30-days">Last 30 Days</option>
            <option value="90-days">Last 90 Days</option>
            <option value="1-year">Last Year</option>
          </select>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Active Competitions */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Trophy className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Competitions</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeCompetitions || 0}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <Target className="h-4 w-4 text-blue-500" />
            <span className="ml-2 text-sm text-blue-600">
              {stats.totalCompetitions || 0} total
            </span>
          </div>
        </div>

        {/* Pending Scores */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending Scores</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pendingScores || 0}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <span className="ml-2 text-sm text-yellow-600">
              Need verification
            </span>
          </div>
        </div>

        {/* Total Registrations */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Registrations</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalRegistrations || 0}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span className="ml-2 text-sm text-green-600">
              +{stats.newRegistrationsThisPeriod || 0} this period
            </span>
          </div>
        </div>

        {/* Revenue */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Range Revenue</p>
              <p className="text-2xl font-bold text-gray-900">${stats.totalRevenue || 0}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span className="ml-2 text-sm text-green-600">
              +${stats.revenueThisPeriod || 0} this period
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Competitions */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">My Competitions</h3>
            <Trophy className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {competitionsLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : competitions.length > 0 ? (
              competitions.slice(0, 5).map((competition) => (
                <div key={competition.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{competition.title}</p>
                    <p className="text-xs text-gray-500">
                      {competition.status === 'published' ? 'Published' : competition.status}
                      {competition.registeredCount > 0 && ` • ${competition.registeredCount} registered`}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => navigate(`/competitions/${competition.id}/edit`)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => navigate(`/competitions/${competition.id}`)}
                      className="p-2 text-gray-600 hover:bg-gray-50 rounded"
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600 text-sm">No competitions yet</p>
                <button
                  onClick={() => navigate('/admin/create-competition')}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  Create Your First Competition
                </button>
              </div>
            )}
          </div>
          {competitions.length > 5 && (
            <button
              onClick={() => navigate('/range-admin/competitions')}
              className="mt-4 w-full px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              View All Competitions ({competitions.length})
            </button>
          )}
        </div>

        {/* Pending Scores */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Pending Score Verification</h3>
            <Clock className="h-5 w-5 text-yellow-600" />
          </div>
          <div className="space-y-3">
            {pendingScoresLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : pendingScores.length > 0 ? (
              pendingScores.slice(0, 5).map((score) => (
                <div key={score.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {score.competitor?.firstName && score.competitor?.lastName 
                        ? `${score.competitor.firstName} ${score.competitor.lastName}`
                        : score.competitor?.username || 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Score: {score.score || score.totalScore} • {score.competition?.title || 'Competition'}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/admin/score-verification')}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Review
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-2" />
                <p className="text-gray-600 text-sm">No pending scores</p>
              </div>
            )}
          </div>
          {pendingScores.length > 5 && (
            <button
              onClick={() => navigate('/admin/score-verification')}
              className="mt-4 w-full px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              View All Pending Scores ({pendingScores.length})
            </button>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/admin/create-competition')}
            className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Competition
          </button>
          <button
            onClick={() => navigate('/admin/score-verification')}
            className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            Verify Scores
          </button>
          <button
            onClick={() => navigate('/range-admin/competitions')}
            className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center"
          >
            <Trophy className="w-5 h-5 mr-2" />
            Manage Competitions
          </button>
        </div>
      </div>
    </div>
  );
};

export default RangeAdminDashboard;

