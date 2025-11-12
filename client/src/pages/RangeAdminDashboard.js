import React, { useMemo, useState } from 'react';
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
import { format, formatDistanceToNow, differenceInCalendarDays } from 'date-fns';

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

  const parseDate = (value) => {
    if (!value) return null;
    if (value.toDate) return value.toDate();
    if (value.seconds) return new Date(value.seconds * 1000);
    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? null : new Date(parsed);
    }
    if (value instanceof Date) return value;
    return null;
  };

  // Get range admin's range info first
  const rangeRecord = rangeData?.data?.range;
  const rangeId = rangeRecord?.id;
  const rangeName = rangeRecord?.name || user?.rangeName;

  // Get dashboard stats for this range
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery(
    ['range-admin-dashboard', rangeId, selectedPeriod],
    () => rangeAdminAPI.getDashboard({ rangeId, period: selectedPeriod }),
    {
      enabled: !!rangeId,
      staleTime: 5 * 60 * 1000,
    }
  );

  // Use dashboard range if available, otherwise fall back to rangeData
  const finalRangeRecord = dashboardData?.range || rangeRecord;

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
  const revenue = dashboardData?.revenue || {};
  const paymentInfo = dashboardData?.payment || {};
  const revenueEntries = revenue.entries || [];
  const revenueEntryPreview = revenueEntries.slice(0, 5);

  const competitionsById = useMemo(() => {
    const map = new Map();
    competitions.forEach((competition) => {
      if (competition?.id) {
        map.set(competition.id, competition.title || competition.name || competition.rangeName || 'Competition');
      }
    });
    return map;
  }, [competitions]);

  const subscriptionStatus = (paymentInfo.subscriptionStatus || finalRangeRecord?.subscriptionStatus || user?.subscriptionStatus || 'inactive').toLowerCase();
  const renewalDate = parseDate(paymentInfo.renewalDate || finalRangeRecord?.subscriptionRenewalDate || user?.subscriptionRenewalDate);
  const lastPaymentDate = parseDate(paymentInfo.lastPaymentDate || finalRangeRecord?.subscriptionLastPaymentDate || user?.subscriptionLastPaymentDate);
  const paymentCurrency = paymentInfo.currency || finalRangeRecord?.subscriptionCurrency || 'USD';
  const paymentAmount = paymentInfo.amount || finalRangeRecord?.subscriptionAmount || 20;

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat('en-US', { style: 'currency', currency: paymentCurrency }),
    [paymentCurrency]
  );
  const formatCurrency = (value) => currencyFormatter.format(value || 0);

  const revenueTotal = stats.totalRevenue || 0;
  const revenueThisPeriod = stats.revenueThisPeriod || 0;
  const revenueEntryCount = stats.revenueEntryCount || revenueEntries.length || 0;

  const daysUntilRenewal = renewalDate ? differenceInCalendarDays(renewalDate, new Date()) : null;
  const renewalRelative = renewalDate ? formatDistanceToNow(renewalDate, { addSuffix: true }) : null;
  const formattedRenewal = renewalDate ? format(renewalDate, 'PPP') : 'Not scheduled';
  const formattedLastPayment = lastPaymentDate ? format(lastPaymentDate, 'PPP') : 'No payments yet';

  const showPastDue = subscriptionStatus !== 'active';
  const showRenewalWarning = !showPastDue && renewalDate && daysUntilRenewal !== null && daysUntilRenewal >= 0 && daysUntilRenewal <= 7;
  const subscriptionBadgeClasses = subscriptionStatus === 'active'
    ? 'bg-green-100 text-green-700'
    : 'bg-red-100 text-red-700';

  const manageSubscription = () => navigate('/range-admin/subscription');

  if (rangeLoading || dashboardLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!finalRangeRecord && !rangeName) {
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
            disabled={showPastDue}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center ${
              showPastDue
                ? 'bg-blue-300 text-white cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
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

      {showPastDue && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3 text-red-700">
          <AlertTriangle className="h-5 w-5 mt-0.5" />
          <div>
            <p className="font-semibold">Subscription inactive</p>
            <p className="text-sm">Renew your subscription to regain full access to range admin tools.</p>
            <button
              onClick={manageSubscription}
              className="mt-2 inline-flex text-sm font-medium text-red-700 hover:text-red-800"
            >
              Manage subscription
            </button>
          </div>
        </div>
      )}

      {showRenewalWarning && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start space-x-3 text-amber-800">
          <Clock className="h-5 w-5 mt-0.5" />
          <div>
            <p className="font-semibold">Renewal approaching</p>
            <p className="text-sm">Your subscription renews {renewalRelative}. Ensure your payment method is current.</p>
          </div>
        </div>
      )}

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
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(revenueTotal)}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="ml-2 text-sm text-green-600">
                +{formatCurrency(revenueThisPeriod)} this period
              </span>
            </div>
            <span className="text-xs text-gray-500">{revenueEntryCount} revenue events</span>
          </div>
        </div>
      </div>

      {/* Subscription Overview */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Subscription Status</p>
            <p className="text-2xl font-bold text-gray-900 capitalize">{subscriptionStatus.replace(/_/g, ' ')}</p>
          </div>
          <span className={`px-3 py-1 text-sm font-medium rounded-full ${subscriptionBadgeClasses}`}>
            {subscriptionStatus}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Next Renewal</p>
            <p className="font-medium">{formattedRenewal}</p>
            {renewalRelative && <p className="text-xs text-gray-500">{renewalRelative}</p>}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Last Payment</p>
            <p className="font-medium">{formattedLastPayment}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Monthly Fee</p>
            <p className="font-medium">{formatCurrency(paymentAmount)}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={manageSubscription}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-sm font-medium"
          >
            Manage Subscription
          </button>
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

        {/* Revenue Activity */}
        <div className="bg-white rounded-lg shadow-sm border p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Revenue</h3>
            <BarChart3 className="h-5 w-5 text-gray-400" />
          </div>
          {revenueEntryPreview.length === 0 ? (
            <p className="text-sm text-gray-500">No revenue recorded yet. Approved score fees will appear here.</p>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:-mx-6 md:mx-0">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 py-2 text-left font-semibold text-gray-600">Date</th>
                    <th scope="col" className="px-4 py-2 text-left font-semibold text-gray-600">Competition</th>
                    <th scope="col" className="px-4 py-2 text-left font-semibold text-gray-600">Amount</th>
                    <th scope="col" className="px-4 py-2 text-left font-semibold text-gray-600">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {revenueEntryPreview.map((entry) => (
                    <tr key={entry.id} className="odd:bg-gray-50">
                      <td className="px-4 py-2 text-gray-700">{entry.approvedAt ? format(entry.approvedAt, 'PP') : '—'}</td>
                      <td className="px-4 py-2 text-gray-700">
                        {competitionsById.get(entry.competitionId) || entry.competitionId || 'Competition'}
                      </td>
                      <td className="px-4 py-2 font-semibold text-gray-900">{formatCurrency(entry.amount || 0)}</td>
                      <td className="px-4 py-2 text-gray-500">
                        {entry.approvedBy ? `#${String(entry.approvedBy).slice(0, 6)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <button
              onClick={manageSubscription}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View billing & payment history
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/admin/create-competition')}
            disabled={showPastDue}
            className={`px-4 py-3 rounded-lg transition-colors flex items-center justify-center ${
              showPastDue
                ? 'bg-blue-300 text-white cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Competition
          </button>
          <button
            onClick={() => navigate('/admin/score-verification')}
            disabled={showPastDue}
            className={`px-4 py-3 rounded-lg transition-colors flex items-center justify-center ${
              showPastDue
                ? 'bg-green-300 text-white cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
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

