import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useQuery } from 'react-query';
import { usersAPI, authAPI } from '../services/api.firebase';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import RankLogo from '../components/RankLogo';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { 
  UserIcon, 
  TrophyIcon, 
  ChartBarIcon, 
  CalendarIcon,
  MapPinIcon,
  PhoneIcon,
  EnvelopeIcon,
  CogIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
} from '@heroicons/react/24/outline';

const Profile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [shotsModalScore, setShotsModalScore] = useState(null);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  // Determine which user's profile to display
  const isAdminViewingOther = userId && currentUser?.role === 'admin' && userId !== currentUser?.id;
  const targetUserId = userId || currentUser?.id;
  const isViewingOwnProfile = !userId || userId === currentUser?.id;

  // Fetch the target user's profile if viewing another user
  const { data: targetUserData, isLoading: profileLoading } = useQuery(
    ['user-profile', targetUserId],
    async () => {
      if (!targetUserId) return null;
      if (isViewingOwnProfile) return { user: currentUser };
      // Admin viewing another user - fetch their profile
      const resp = await usersAPI.getProfile(targetUserId);
      return resp.data;
    },
    { 
      enabled: !!targetUserId,
      staleTime: 5 * 60 * 1000,
    }
  );

  // Use the target user's data or fall back to current user
  const user = targetUserData?.user || currentUser;

  // Function to get classification badge styles
  const normalizeClass = (classification) =>
    (classification || '').toLowerCase().replace(/^provisional\s+/, '').trim();

  const displayClass = (classification) =>
    (classification || '').toString().replace(/^provisional\s+/i, '').trim();

  const getClassStyles = (classification) => {
    switch (normalizeClass(classification)) {
      case 'grand master':
        return 'bg-purple-50 text-purple-700 border border-purple-200';
      case 'master':
        return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'diamond':
        return 'bg-cyan-50 text-cyan-700 border border-cyan-200';
      case 'platinum':
        return 'bg-gray-50 text-gray-700 border border-gray-200';
      case 'gold':
        return 'bg-yellow-50 text-yellow-800 border border-yellow-200';
      case 'bronze':
        return 'bg-orange-50 text-orange-700 border border-orange-200';
      default:
        return 'bg-gray-50 text-gray-700 border border-gray-200';
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch
  } = useForm();

  // Fetch user's competition history and statistics
  const { data: userStats, isLoading: statsLoading } = useQuery(
    ['user-stats', targetUserId],
    async () => {
      if (!targetUserId) return null;
      const resp = await usersAPI.getScores(targetUserId);
      return resp.data;
    },
    { enabled: !!targetUserId && !!user }
  );

  const { data: userCompetitions, isLoading: competitionsLoading } = useQuery(
    ['user-competitions', targetUserId],
    async () => {
      if (!targetUserId) return null;
      const resp = await usersAPI.getCompetitions(targetUserId);
      return resp.data;
    },
    { enabled: !!targetUserId && !!user }
  );

  const handleProfileUpdate = async (data) => {
    try {
      // Only allow updating own profile or admin updating another user
      if (!isViewingOwnProfile && currentUser?.role !== 'admin') {
        toast.error('You can only edit your own profile');
        return;
      }
      
      if (isViewingOwnProfile) {
        const result = await usersAPI.updateProfile(data);
        updateUser(result.user);
      } else {
        // Admin updating another user's profile - would need an admin API endpoint
        toast.error('Admin profile updates not yet implemented');
        return;
      }
      setIsEditing(false);
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error('Failed to update profile');
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    reset();
  };

  const handleChangePassword = async (data) => {
    try {
      await authAPI.changePassword(data.currentPassword, data.newPassword);
      toast.success('Password changed successfully!');
      setShowChangePasswordModal(false);
    } catch (error) {
      console.error('Change password error:', error);
      toast.error(error.message || 'Failed to change password. Please try again.');
    }
  };

  const tabs = [
    { id: 'overview', name: 'Overview', icon: UserIcon },
    { id: 'statistics', name: 'Statistics', icon: ChartBarIcon },
            { id: 'history', name: 'Competition History', icon: CalendarIcon },
            ...(isViewingOwnProfile ? [{ id: 'settings', name: 'Settings', icon: CogIcon }] : [])
  ];

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="w-20 h-20 bg-rifle-600 rounded-full flex items-center justify-center">
              <UserIcon className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {user?.firstName} {user?.lastName}
              </h2>
              <p className="text-gray-600">@{user?.username}</p>
              
              {/* Rank/Classification Display */}
              {user?.classification && user.classification !== 'Unclassified' && (
                <div className="flex items-center space-x-2 mt-2">
                  <RankLogo classification={user.classification} size={24} />
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getClassStyles(user.classification)}`}>
                    {displayClass(user.classification)}
                  </span>
                </div>
              )}
              
              <div className="flex items-center space-x-4 mt-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  user?.role === 'competitor' ? 'bg-blue-100 text-blue-800' :
                  user?.role === 'range_officer' ? 'bg-green-100 text-green-800' :
                  'bg-purple-100 text-purple-800'
                }`}>
                  {user?.role?.replace('_', ' ')}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  user?.isVerified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {user?.isVerified ? 'Verified' : 'Pending Verification'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {isAdminViewingOther && (
              <button
                onClick={() => navigate('/admin/users')}
                className="btn-secondary flex items-center space-x-2"
              >
                <span>← Back to Users</span>
              </button>
            )}
            {isViewingOwnProfile && (
              <button
                onClick={() => setIsEditing(true)}
                className="btn-secondary flex items-center space-x-2"
              >
                <PencilIcon className="w-4 h-4" />
                <span>Edit Profile</span>
              </button>
            )}
          </div>
        </div>

        {/* Personal Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <EnvelopeIcon className="w-5 h-5 text-gray-400" />
                <span className="text-gray-900">{user?.email}</span>
              </div>
              {user?.phone && (
                <div className="flex items-center space-x-3">
                  <PhoneIcon className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-900">{user?.phone}</span>
                </div>
              )}
              {user?.location && (
                <div className="flex items-center space-x-3">
                  <MapPinIcon className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-900">{user?.location}</span>
                </div>
              )}
              {user?.dateOfBirth && (
                <div className="flex items-center space-x-3">
                  <CalendarIcon className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-900">
                    {formatDate(user.dateOfBirth)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Quick Stats</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-rifle-600">{totalCompetitions || user?.totalCompetitions || 0}</div>
                <div className="text-sm text-gray-600">Competitions</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-rifle-600">{totalScores || user?.totalScores || 0}</div>
                <div className="text-sm text-gray-600">Scores</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-rifle-600">{bestIndoor || user?.personalBestIndoor || 0}</div>
                <div className="text-sm text-gray-600">Best Indoor</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-rifle-600">{bestOutdoor || user?.personalBestOutdoor || 0}</div>
                <div className="text-sm text-gray-600">Best Outdoor</div>
              </div>
            </div>
            
            {/* Rank/Classification Display */}
            {user?.classification && user.classification !== 'Unclassified' && (
              <div className="mt-4 p-4 bg-gradient-to-r from-rifle-50 to-rifle-100 rounded-lg border border-rifle-200">
                <div className="flex items-center justify-center space-x-3">
                  <RankLogo classification={user.classification} size={32} />
                  <div className="text-center">
                    <div className="text-lg font-semibold text-rifle-800">Current Rank</div>
                    <div className="text-2xl font-bold text-rifle-900">{displayClass(user.classification)}</div>
                    {user?.averageScore && (
                      <div className="text-sm text-rifle-700">
                        Avg Score: {user.averageScore.toFixed(1)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Profile Form */}
      {isEditing && isViewingOwnProfile && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Profile</h3>
          <form onSubmit={handleSubmit(handleProfileUpdate)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">First Name</label>
                <input
                  type="text"
                  defaultValue={user?.firstName}
                  {...register('firstName', { required: 'First name is required' })}
                  className="input-field mt-1"
                />
                {errors.firstName && (
                  <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Last Name</label>
                <input
                  type="text"
                  defaultValue={user?.lastName}
                  {...register('lastName', { required: 'Last name is required' })}
                  className="input-field mt-1"
                />
                {errors.lastName && (
                  <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone Number</label>
              <input
                type="tel"
                defaultValue={user?.phone}
                {...register('phone')}
                className="input-field mt-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Location</label>
              <input
                type="text"
                defaultValue={user?.location}
                {...register('location')}
                className="input-field mt-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Bio</label>
              <textarea
                defaultValue={user?.bio}
                {...register('bio')}
                rows={3}
                className="input-field mt-1"
                placeholder="Tell us about yourself..."
              />
            </div>
            <div className="flex space-x-3">
              <button type="submit" className="btn-primary flex items-center space-x-2">
                <CheckIcon className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="btn-secondary flex items-center space-x-2"
              >
                <XMarkIcon className="w-4 h-4" />
                <span>Cancel</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );

  // Helpers - moved before useMemo to be in scope
  const toNumberScore = (s) => {
    if (!s) return 0;
    const v = typeof s.score === 'number' ? s.score : typeof s.totalScore === 'number' ? s.totalScore : parseInt(s.score, 10);
    return Number.isFinite(v) ? v : 0;
  };

  const formatDate = (ts) => {
    if (!ts) return 'N/A';
    try {
      if (typeof ts === 'object') {
        if (typeof ts.toDate === 'function') return ts.toDate().toLocaleDateString();
        if (typeof ts.toMillis === 'function') return new Date(ts.toMillis()).toLocaleDateString();
        if (typeof ts._seconds === 'number') return new Date(ts._seconds * 1000).toLocaleDateString();
        if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000).toLocaleDateString();
      }
      const d = new Date(ts);
      return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
    } catch (_) {
      return 'N/A';
    }
  };

  const scores = userStats?.scores || [];
  
  // Comprehensive statistics calculations using useMemo
  const stats = useMemo(() => {
    if (scores.length === 0) {
      return {
        totalScores: 0,
        totalCompetitions: 0,
        avgScore: 0,
        bestIndoor: 0,
        bestOutdoor: 0,
        sortedScores: [],
        scoreTrend: [],
        scoreDistribution: [],
        xCountData: [],
        indoorVsOutdoor: [],
        consistency: 0,
        improvement: 0,
        currentStreak: 0,
        bestStreak: 0,
        totalXCount: 0,
        avgXCount: 0,
        minScore: 0,
        maxScore: 0,
        medianScore: 0,
        shotValueDistribution: [],
        shotPositionPerformance: [],
        shotGroupingData: [],
        xHitRateTrend: [],
        perfectShotPercentage: 0,
        tenShotPercentage: 0,
        positionConsistency: [],
        totalShots: 0,
      };
    }

    // Sort scores by date (oldest first for trend)
    const sortedByDate = [...scores].sort((a, b) => {
      const ad = new Date(a?.createdAt || a?.submittedAt || a?.date || 0).getTime();
      const bd = new Date(b?.createdAt || b?.submittedAt || b?.date || 0).getTime();
      return ad - bd;
    });

    // Sort scores newest-first for display
    const sortedScores = [...sortedByDate].reverse();

    const totalScores = scores.length;
    const totalCompetitions = new Set(scores.map(s => s.competitionId)).size;
    const scoreValues = scores.map(s => toNumberScore(s));
    const avgScore = scoreValues.reduce((sum, s) => sum + s, 0) / totalScores;
    const minScore = Math.min(...scoreValues);
    const maxScore = Math.max(...scoreValues);
    const sortedValues = [...scoreValues].sort((a, b) => a - b);
    const medianScore = sortedValues.length % 2 === 0
      ? (sortedValues[sortedValues.length / 2 - 1] + sortedValues[sortedValues.length / 2]) / 2
      : sortedValues[Math.floor(sortedValues.length / 2)];

    const bestIndoor = scores
      .filter(s => s?.competition?.competitionType === 'indoor')
      .reduce((max, s) => Math.max(max, toNumberScore(s)), 0);
    const bestOutdoor = scores
      .filter(s => s?.competition?.competitionType === 'outdoor')
      .reduce((max, s) => Math.max(max, toNumberScore(s)), 0);

    // Calculate X-count statistics
    const getXCount = (s) => {
      if (s?.tiebreakerData?.xCount !== undefined) return s.tiebreakerData.xCount;
      if (Array.isArray(s?.shots)) return s.shots.filter(sh => sh?.isX === true).length;
      return 0;
    };
    const xCounts = scores.map(getXCount);
    const totalXCount = xCounts.reduce((sum, x) => sum + x, 0);
    const avgXCount = totalXCount / totalScores;

    // Score trend data (last 20 scores or all if less)
    const recentScores = sortedByDate.slice(-20);
    const scoreTrend = recentScores.map((s, idx) => {
      const date = new Date(s?.createdAt || s?.submittedAt || s?.date || Date.now());
      return {
        index: idx + 1,
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        score: toNumberScore(s),
        xCount: getXCount(s),
      };
    });

    // Score distribution (bins: 0-200, 201-210, 211-220, 221-230, 231-240, 241-250)
    const bins = [
      { range: '0-200', min: 0, max: 200, count: 0 },
      { range: '201-210', min: 201, max: 210, count: 0 },
      { range: '211-220', min: 211, max: 220, count: 0 },
      { range: '221-230', min: 221, max: 230, count: 0 },
      { range: '231-240', min: 231, max: 240, count: 0 },
      { range: '241-250', min: 241, max: 250, count: 0 },
    ];
    scoreValues.forEach(score => {
      const bin = bins.find(b => score >= b.min && score <= b.max);
      if (bin) bin.count++;
    });
    const scoreDistribution = bins;

    // X-count distribution
    const xBins = [
      { range: '0-2', min: 0, max: 2, count: 0 },
      { range: '3-5', min: 3, max: 5, count: 0 },
      { range: '6-8', min: 6, max: 8, count: 0 },
      { range: '9-12', min: 9, max: 12, count: 0 },
      { range: '13-20', min: 13, max: 20, count: 0 },
      { range: '21+', min: 21, max: 100, count: 0 },
    ];
    xCounts.forEach(x => {
      const bin = xBins.find(b => x >= b.min && x <= b.max);
      if (bin) bin.count++;
    });
    const xCountData = xBins;

    // Indoor vs Outdoor comparison
    const indoor = scores.filter(s => s?.competition?.competitionType === 'indoor');
    const outdoor = scores.filter(s => s?.competition?.competitionType === 'outdoor');
    const indoorVsOutdoor = [
      { name: 'Indoor', count: indoor.length, avgScore: indoor.length > 0 ? indoor.reduce((sum, s) => sum + toNumberScore(s), 0) / indoor.length : 0 },
      { name: 'Outdoor', count: outdoor.length, avgScore: outdoor.length > 0 ? outdoor.reduce((sum, s) => sum + toNumberScore(s), 0) / outdoor.length : 0 },
    ];

    // Consistency (standard deviation)
    const variance = scoreValues.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / totalScores;
    const consistency = Math.sqrt(variance);

    // Improvement trend (comparing first half vs second half)
    const midpoint = Math.floor(totalScores / 2);
    const firstHalf = sortedByDate.slice(0, midpoint);
    const secondHalf = sortedByDate.slice(midpoint);
    const firstHalfAvg = firstHalf.length > 0 ? firstHalf.reduce((sum, s) => sum + toNumberScore(s), 0) / firstHalf.length : 0;
    const secondHalfAvg = secondHalf.length > 0 ? secondHalf.reduce((sum, s) => sum + toNumberScore(s), 0) / secondHalf.length : 0;
    const improvement = secondHalfAvg - firstHalfAvg;

    // Streak calculations
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;
    for (let i = sortedByDate.length - 1; i >= 0; i--) {
      const score = toNumberScore(sortedByDate[i]);
      if (score >= avgScore) {
        tempStreak++;
        if (i === sortedByDate.length - 1) currentStreak = tempStreak;
        bestStreak = Math.max(bestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }

    // Shot-level analysis - collect all individual shots
    const allShots = [];
    scores.forEach(score => {
      if (Array.isArray(score.shots)) {
        score.shots.forEach((shot, index) => {
          const shotValue = shot?.isX === true ? 10 : (parseInt(shot?.value, 10) || 0);
          allShots.push({
            value: shotValue,
            isX: shot?.isX === true,
            position: index + 1,
            scoreId: score.id,
            date: score?.createdAt || score?.submittedAt || score?.date,
          });
        });
      }
    });

    // Shot value distribution (0-10)
    const shotValueDistribution = Array.from({ length: 11 }, (_, i) => ({
      value: i,
      count: allShots.filter(s => s.value === i).length,
      percentage: allShots.length > 0 ? (allShots.filter(s => s.value === i).length / allShots.length * 100) : 0,
    }));

    // Shot position performance (average score by position 1-25)
    const maxShotsPerTarget = Math.max(...scores.map(s => s.shots?.length || 0), 25);
    const shotPositionPerformance = Array.from({ length: maxShotsPerTarget }, (_, i) => {
      const position = i + 1;
      const shotsAtPosition = allShots.filter(s => s.position === position);
      if (shotsAtPosition.length === 0) return { position, avgValue: 0, count: 0, xRate: 0 };
      const avgValue = shotsAtPosition.reduce((sum, s) => sum + s.value, 0) / shotsAtPosition.length;
      const xRate = shotsAtPosition.filter(s => s.isX).length / shotsAtPosition.length * 100;
      return { position, avgValue: Math.round(avgValue * 10) / 10, count: shotsAtPosition.length, xRate: Math.round(xRate * 10) / 10 };
    });

    // Shot grouping analysis (first 5, middle, last 5)
    const groupingAnalysis = [];
    scores.forEach(score => {
      if (Array.isArray(score.shots) && score.shots.length >= 10) {
        const shots = score.shots.map(s => s?.isX === true ? 10 : (parseInt(s?.value, 10) || 0));
        const first5 = shots.slice(0, 5);
        const middle = shots.slice(5, -5);
        const last5 = shots.slice(-5);
        
        groupingAnalysis.push({
          scoreId: score.id,
          first5Avg: first5.reduce((a, b) => a + b, 0) / first5.length,
          middleAvg: middle.length > 0 ? middle.reduce((a, b) => a + b, 0) / middle.length : 0,
          last5Avg: last5.reduce((a, b) => a + b, 0) / last5.length,
        });
      }
    });

    const avgFirst5 = groupingAnalysis.length > 0 
      ? groupingAnalysis.reduce((sum, g) => sum + g.first5Avg, 0) / groupingAnalysis.length 
      : 0;
    const avgMiddle = groupingAnalysis.length > 0 
      ? groupingAnalysis.reduce((sum, g) => sum + g.middleAvg, 0) / groupingAnalysis.length 
      : 0;
    const avgLast5 = groupingAnalysis.length > 0 
      ? groupingAnalysis.reduce((sum, g) => sum + g.last5Avg, 0) / groupingAnalysis.length 
      : 0;

    const shotGroupingData = [
      { group: 'First 5', avgScore: Math.round(avgFirst5 * 10) / 10 },
      { group: 'Middle', avgScore: Math.round(avgMiddle * 10) / 10 },
      { group: 'Last 5', avgScore: Math.round(avgLast5 * 10) / 10 },
    ];

    // X-hit rate trend over time
    const xHitRateTrend = [];
    const scoresWithShots = sortedByDate.filter(s => Array.isArray(s.shots) && s.shots.length > 0);
    scoresWithShots.forEach(score => {
      const shots = score.shots;
      const xCount = shots.filter(s => s?.isX === true).length;
      const xRate = (xCount / shots.length) * 100;
      const date = new Date(score?.createdAt || score?.submittedAt || score?.date || Date.now());
      xHitRateTrend.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        xRate: Math.round(xRate * 10) / 10,
        xCount,
        totalShots: shots.length,
      });
    });

    // Ten-shot percentage (non-X 10s)
    const tenShots = allShots.filter(s => s.value === 10 && !s.isX).length;
    const tenShotPercentage = allShots.length > 0 ? (tenShots / allShots.length * 100) : 0;

    // Perfect shot percentage (X-shots are the perfect shots)
    const perfectShots = allShots.filter(s => s.isX).length;
    const perfectShotPercentage = allShots.length > 0 ? (perfectShots / allShots.length * 100) : 0;

    // Shot consistency by position (standard deviation)
    const positionConsistency = shotPositionPerformance.map(pos => {
      if (pos.count === 0) return { ...pos, stdDev: 0 };
      const shotsAtPos = allShots.filter(s => s.position === pos.position);
      const values = shotsAtPos.map(s => s.value);
      const avg = pos.avgValue;
      const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);
      return { ...pos, stdDev: Math.round(stdDev * 10) / 10 };
    });

    return {
      totalScores,
      totalCompetitions,
      avgScore: Math.round(avgScore * 10) / 10,
      bestIndoor,
      bestOutdoor,
      sortedScores,
      scoreTrend,
      scoreDistribution,
      xCountData,
      indoorVsOutdoor,
      consistency: Math.round(consistency * 10) / 10,
      improvement: Math.round(improvement * 10) / 10,
      currentStreak,
      bestStreak,
      totalXCount,
      avgXCount: Math.round(avgXCount * 10) / 10,
      minScore,
      maxScore,
      medianScore: Math.round(medianScore * 10) / 10,
      // New shot-level statistics
      shotValueDistribution: allShots.length > 0 ? shotValueDistribution : [],
      shotPositionPerformance: allShots.length > 0 ? shotPositionPerformance : [],
      shotGroupingData: allShots.length > 0 ? shotGroupingData : [],
      xHitRateTrend: allShots.length > 0 ? xHitRateTrend.slice(-20) : [], // Last 20 competitions
      perfectShotPercentage: Math.round(perfectShotPercentage * 10) / 10,
      tenShotPercentage: Math.round(tenShotPercentage * 10) / 10,
      positionConsistency: allShots.length > 0 ? positionConsistency : [],
      totalShots: allShots.length,
    };
  }, [scores]);

  const { 
    totalScores, totalCompetitions, avgScore, bestIndoor, bestOutdoor, sortedScores, scoreTrend, 
    scoreDistribution, xCountData, indoorVsOutdoor, consistency, improvement, currentStreak, bestStreak, 
    totalXCount, avgXCount, minScore, maxScore, medianScore,
    shotValueDistribution, shotPositionPerformance, shotGroupingData, xHitRateTrend,
    perfectShotPercentage, tenShotPercentage, positionConsistency, totalShots
  } = stats;

  const renderStatistics = () => {
    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    if (statsLoading) {
      return (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rifle-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading statistics...</p>
        </div>
      );
    }

    if (totalScores === 0) {
      return (
        <div className="text-center py-12">
          <TrophyIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">No scores submitted yet</p>
          <p className="text-sm text-gray-500 mt-2">Participate in competitions to see your statistics</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Enhanced Performance Overview */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 text-center border border-blue-200">
              <div className="text-2xl font-bold text-blue-700">{avgScore}</div>
              <div className="text-xs text-blue-600 mt-1">Average Score</div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 text-center border border-green-200">
              <div className="text-2xl font-bold text-green-700">{maxScore}</div>
              <div className="text-xs text-green-600 mt-1">Best Score</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 text-center border border-purple-200">
              <div className="text-2xl font-bold text-purple-700">{medianScore}</div>
              <div className="text-xs text-purple-600 mt-1">Median Score</div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 text-center border border-orange-200">
              <div className="text-2xl font-bold text-orange-700">{bestIndoor || '—'}</div>
              <div className="text-xs text-orange-600 mt-1">Best Indoor</div>
            </div>
            <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-lg p-4 text-center border border-cyan-200">
              <div className="text-2xl font-bold text-cyan-700">{bestOutdoor || '—'}</div>
              <div className="text-xs text-cyan-600 mt-1">Best Outdoor</div>
            </div>
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4 text-center border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-700">{avgXCount.toFixed(1)}</div>
              <div className="text-xs text-yellow-600 mt-1">Avg X Count</div>
            </div>
          </div>
        </div>

        {/* Advanced Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Consistency</p>
                <p className="text-2xl font-bold text-gray-900">{consistency.toFixed(1)}</p>
                <p className="text-xs text-gray-500 mt-1">Lower is better</p>
              </div>
              <div className={`p-3 rounded-lg ${consistency < 5 ? 'bg-green-100' : consistency < 10 ? 'bg-yellow-100' : 'bg-red-100'}`}>
                {consistency < 5 ? <ArrowTrendingUpIcon className="w-6 h-6 text-green-600" /> : <ArrowTrendingDownIcon className="w-6 h-6 text-red-600" />}
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Improvement</p>
                <p className={`text-2xl font-bold ${improvement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {improvement >= 0 ? '+' : ''}{improvement.toFixed(1)}
                </p>
                <p className="text-xs text-gray-500 mt-1">vs early performance</p>
              </div>
              {improvement >= 0 ? (
                <ArrowTrendingUpIcon className="w-6 h-6 text-green-600" />
              ) : (
                <ArrowTrendingDownIcon className="w-6 h-6 text-red-600" />
              )}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Current Streak</p>
                <p className="text-2xl font-bold text-blue-600">{currentStreak}</p>
                <p className="text-xs text-gray-500 mt-1">Above average</p>
              </div>
              <TrophyIcon className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Best Streak</p>
                <p className="text-2xl font-bold text-purple-600">{bestStreak}</p>
                <p className="text-xs text-gray-500 mt-1">All time</p>
              </div>
              <TrophyIcon className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Score Trend Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Score Trend (Last 20 Competitions)</h3>
          {scoreTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={scoreTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="date" 
                  stroke="#6b7280"
                  fontSize={11}
                  tick={{ fill: '#6b7280' }}
                />
                <YAxis 
                  domain={[Math.max(0, minScore - 10), Math.min(250, maxScore + 10)]}
                  stroke="#6b7280"
                  fontSize={11}
                  tick={{ fill: '#6b7280' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    color: '#111827'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  name="Score"
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-gray-500">No trend data available</div>
          )}
        </div>

        {/* Shot-Level Statistics */}
        {totalShots > 0 && (
          <>
            {/* Shot Value Distribution */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Shot Value Distribution</h3>
              <p className="text-sm text-gray-600 mb-4">Distribution of individual shot values across all competitions</p>
              {shotValueDistribution.some(s => s.count > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={shotValueDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="value" 
                      stroke="#6b7280"
                      fontSize={11}
                      tick={{ fill: '#6b7280' }}
                      label={{ value: 'Shot Value', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis 
                      stroke="#6b7280"
                      fontSize={11}
                      tick={{ fill: '#6b7280' }}
                      label={{ value: 'Count', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        color: '#111827'
                      }}
                      formatter={(value, name, props) => [
                        `${value} shots (${shotValueDistribution.find(s => s.value === props.payload.value)?.percentage.toFixed(1)}%)`,
                        'Count'
                      ]}
                    />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                      {shotValueDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.value === 10 ? '#10b981' : entry.value >= 8 ? '#3b82f6' : entry.value >= 5 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-gray-500">No shot data available</div>
              )}
              <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-green-700">{perfectShotPercentage.toFixed(1)}%</div>
                  <div className="text-xs text-green-600">Perfect Shots (X)</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-blue-700">{tenShotPercentage.toFixed(1)}%</div>
                  <div className="text-xs text-blue-600">10s (Best Score)</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-gray-700">{totalShots}</div>
                  <div className="text-xs text-gray-600">Total Shots</div>
                </div>
              </div>
            </div>

            {/* Shot Position Performance */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Average Score by Shot Position</h3>
              <p className="text-sm text-gray-600 mb-4">Performance analysis across shot positions (1-{shotPositionPerformance.length})</p>
              {shotPositionPerformance.some(p => p.count > 0) ? (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={shotPositionPerformance.filter(p => p.count > 0)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="position" 
                      stroke="#6b7280"
                      fontSize={10}
                      tick={{ fill: '#6b7280' }}
                      label={{ value: 'Shot Position', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis 
                      domain={[0, 10]}
                      stroke="#6b7280"
                      fontSize={11}
                      tick={{ fill: '#6b7280' }}
                      label={{ value: 'Average Score', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        color: '#111827'
                      }}
                      formatter={(value, name, props) => {
                        if (name === 'avgValue') {
                          const pos = shotPositionPerformance.find(p => p.position === props.payload.position);
                          return [`${value.toFixed(1)} (${pos?.xRate.toFixed(1)}% X-rate)`, 'Avg Score'];
                        }
                        return [value, name];
                      }}
                    />
                    <Bar dataKey="avgValue" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
                      {shotPositionPerformance.filter(p => p.count > 0).map((entry, index) => {
                        const color = entry.avgValue >= 9.5 ? '#10b981' : entry.avgValue >= 9 ? '#3b82f6' : entry.avgValue >= 8 ? '#f59e0b' : '#ef4444';
                        return <Cell key={`cell-${index}`} fill={color} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-gray-500">No position data available</div>
              )}
            </div>

            {/* Shot Grouping Analysis */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance by Shot Grouping</h3>
              <p className="text-sm text-gray-600 mb-4">Average score comparison: First 5 shots vs Middle vs Last 5 shots</p>
              {shotGroupingData.some(g => g.avgScore > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={shotGroupingData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="group" 
                      stroke="#6b7280"
                      fontSize={11}
                      tick={{ fill: '#6b7280' }}
                    />
                    <YAxis 
                      domain={[0, 10]}
                      stroke="#6b7280"
                      fontSize={11}
                      tick={{ fill: '#6b7280' }}
                      label={{ value: 'Average Score', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        color: '#111827'
                      }}
                      formatter={(value) => `${value.toFixed(1)}`}
                    />
                    <Bar dataKey="avgScore" fill="#ec4899" radius={[4, 4, 0, 0]}>
                      {shotGroupingData.map((entry, index) => {
                        const colors = ['#3b82f6', '#8b5cf6', '#ec4899'];
                        return <Cell key={`cell-${index}`} fill={colors[index]} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-gray-500">No grouping data available</div>
              )}
            </div>

            {/* X-Hit Rate Trend */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">X-Hit Rate Trend</h3>
              <p className="text-sm text-gray-600 mb-4">Percentage of X-shots over time (Last 20 competitions)</p>
              {xHitRateTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={xHitRateTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#6b7280"
                      fontSize={11}
                      tick={{ fill: '#6b7280' }}
                    />
                    <YAxis 
                      domain={[0, 100]}
                      stroke="#6b7280"
                      fontSize={11}
                      tick={{ fill: '#6b7280' }}
                      label={{ value: 'X-Hit Rate (%)', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        color: '#111827'
                      }}
                      formatter={(value, name) => {
                        if (name === 'xRate') {
                          const data = xHitRateTrend.find(d => d.xRate === value);
                          return [`${value}% (${data?.xCount}/${data?.totalShots} shots)`, 'X-Hit Rate'];
                        }
                        return [value, name];
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="xRate" 
                      name="X-Hit Rate"
                      stroke="#10b981" 
                      strokeWidth={2}
                      dot={{ fill: '#10b981', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-gray-500">No X-hit rate data available</div>
              )}
            </div>
          </>
        )}

        {/* Indoor vs Outdoor Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Indoor vs Outdoor</h3>
            {indoorVsOutdoor.some(d => d.count > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={indoorVsOutdoor}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {indoorVsOutdoor.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-gray-500">No comparison data</div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Indoor vs Outdoor Average</h3>
            {indoorVsOutdoor.some(d => d.count > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={indoorVsOutdoor}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#6b7280"
                    fontSize={11}
                    tick={{ fill: '#6b7280' }}
                  />
                  <YAxis 
                    domain={[0, 250]}
                    stroke="#6b7280"
                    fontSize={11}
                    tick={{ fill: '#6b7280' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      color: '#111827'
                    }}
                    formatter={(value) => value.toFixed(1)}
                  />
                  <Bar dataKey="avgScore" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-gray-500">No comparison data</div>
            )}
          </div>
        </div>

        {/* Recent Performance */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Performance</h3>
          <div className="space-y-4">
            {sortedScores.slice(0, 10).map((score) => {
              const scoreValue = toNumberScore(score);
              const getXCount = (s) => {
                if (s?.tiebreakerData?.xCount !== undefined) return s.tiebreakerData.xCount;
                if (Array.isArray(s?.shots)) return s.shots.filter(sh => sh?.isX === true).length;
                return 0;
              };
              return (
                <div key={score.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{score.competition?.title || 'Unknown Competition'}</div>
                    <div className="text-sm text-gray-600">{formatDate(score.createdAt || score.submittedAt)}</div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-lg font-bold text-rifle-600">{scoreValue}</div>
                      <div className="text-xs text-gray-500">X: {getXCount(score)}</div>
                    </div>
                    <button
                      onClick={() => setShotsModalScore(score)}
                      className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                    >
                      View Shots
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      {/* Shots Modal */}
      {shotsModalScore && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xl font-semibold text-gray-900">Shots — {shotsModalScore.competition?.title}</h4>
                <button
                  onClick={() => setShotsModalScore(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="grid grid-cols-5 md:grid-cols-10 gap-3 mb-4">
                {(shotsModalScore.shots || []).map((shot, index) => (
                  <div key={index} className="text-center">
                    <label className="block text-xs font-medium text-gray-700 mb-1">{index + 1}</label>
                    <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-medium ${ (shot?.isX === true || parseInt(shot?.value,10) === 10) ? 'border-blue-500 text-blue-600' : 'border-gray-300'}`}>
                      {shot?.isX === true ? 'X' : (parseInt(shot?.value,10) || 0)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                <div className="text-gray-700">
                  Date: <span className="font-medium">{formatDate(shotsModalScore.createdAt || shotsModalScore.submittedAt)}</span>
                </div>
                <div className="text-lg font-semibold text-rifle-700">
                  Total: {toNumberScore(shotsModalScore)} ({(shotsModalScore.tiebreakerData?.xCount) ?? (shotsModalScore.shots?.filter(s=>s?.isX===true).length || 0)}X)
                </div>
              </div>
              {(shotsModalScore?.evidence?.photoUrl || shotsModalScore?.evidence?.videoUrl) && (
                <div className="mt-4">
                  <h5 className="font-medium text-gray-900 mb-2">Evidence</h5>
                  <div className="space-x-4">
                    {shotsModalScore?.evidence?.photoUrl && (
                      <a href={shotsModalScore.evidence.photoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">View Photo</a>
                    )}
                    {shotsModalScore?.evidence?.videoUrl && (
                      <a href={shotsModalScore.evidence.videoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">View Video</a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rank Information */}
      {user?.classification && user.classification !== 'Unclassified' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Rank Information</h3>
          <div className="flex items-center justify-center p-6 bg-gradient-to-r from-rifle-50 to-rifle-100 rounded-lg border border-rifle-200">
            <div className="text-center">
              <div className="flex items-center justify-center mb-4">
                <RankLogo classification={user.classification} size={48} />
              </div>
              <div className="text-3xl font-bold text-rifle-900 mb-2">{displayClass(user.classification)}</div>
              <div className="text-lg text-rifle-700 mb-4">Current Classification</div>
              {user?.averageScore && (
                <div className="text-sm text-rifle-600">
                  Based on average score of {user.averageScore.toFixed(1)}
                </div>
              )}
              <div className="mt-4 text-xs text-rifle-600">
                Classification is automatically calculated based on your performance
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    );
  };

  const renderHistory = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Competition History</h3>
        {competitionsLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rifle-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading competitions...</p>
          </div>
        ) : userCompetitions?.competitions?.length > 0 ? (
          <div className="space-y-4">
            {userCompetitions.competitions.map((competition) => (
              <div key={competition.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900">{competition.title}</h4>
                    <p className="text-sm text-gray-600">{competition.description}</p>
                    <div className="flex items-center space-x-4 mt-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        competition.competitionType === 'indoor' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {competition.competitionType}
                      </span>
                      <span className="text-sm text-gray-600">
                        {new Date(competition.schedule?.competitionDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-gray-900">
                      ${competition.entryFee?.amount}
                    </div>
                    <div className="text-sm text-gray-600">
                      {competition.status}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <CalendarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No competitions participated in yet</p>
            <p className="text-sm text-gray-500">Join competitions to build your history</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Settings</h3>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Account Information</h4>
            <div className="space-y-2 text-sm text-gray-600">
              <div>Username: <span className="font-medium">{user?.username}</span></div>
              <div>Email: <span className="font-medium">{user?.email}</span></div>
              <div>Role: <span className="font-medium capitalize">{user?.role?.replace('_', ' ')}</span></div>
              <div>Member since: <span className="font-medium">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
              </span></div>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <h4 className="font-medium text-gray-900 mb-2">Security</h4>
            <button 
              onClick={() => setShowChangePasswordModal(true)}
              className="btn-secondary"
            >
              Change Password
            </button>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium text-gray-900 mb-2">Preferences</h4>
            <div className="space-y-2">
              <label className="flex items-center">
                <input type="checkbox" className="rounded border-gray-300 text-rifle-600 focus:ring-rifle-500" />
                <span className="ml-2 text-sm text-gray-700">Email notifications for new competitions</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="rounded border-gray-300 text-rifle-600 focus:ring-rifle-500" />
                <span className="ml-2 text-sm text-gray-700">Score verification notifications</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'statistics':
        return renderStatistics();
      case 'history':
        return renderHistory();
      case 'settings':
        return renderSettings();
      default:
        return renderOverview();
    }
  };

  // Show loading state if user is not loaded yet
  if (profileLoading || !user) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-4 drop-shadow-lg">Profile</h1>
          <p className="text-white drop-shadow-md">Manage your account and view your statistics</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rifle-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-4 drop-shadow-lg">
          {isAdminViewingOther ? 'User Profile' : 'Profile'}
        </h1>
        <p className="text-white drop-shadow-md">
          {isAdminViewingOther ? `Viewing ${user?.firstName || user?.username}'s profile` : 'Manage your account and view your statistics'}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? 'border-rifle-500 text-rifle-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>
        <div className="p-6">
          {renderTabContent()}
        </div>
      </div>

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">Change Password</h3>
                <button
                  onClick={() => setShowChangePasswordModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleSubmit(handleChangePassword)} className="space-y-4">
                <div>
                  <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">
                    Current Password
                  </label>
                  <input
                    id="currentPassword"
                    type="password"
                    {...register('currentPassword', {
                      required: 'Current password is required',
                    })}
                    className="input-field mt-1"
                    placeholder="Enter your current password"
                  />
                  {errors.currentPassword && (
                    <p className="mt-1 text-sm text-red-600">{errors.currentPassword.message}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                    New Password
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    {...register('newPassword', {
                      required: 'New password is required',
                      minLength: {
                        value: 6,
                        message: 'Password must be at least 6 characters',
                      },
                    })}
                    className="input-field mt-1"
                    placeholder="Enter your new password"
                  />
                  {errors.newPassword && (
                    <p className="mt-1 text-sm text-red-600">{errors.newPassword.message}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                    Confirm New Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    {...register('confirmPassword', {
                      required: 'Please confirm your new password',
                      validate: (value) =>
                        value === watch('newPassword') || 'Passwords do not match',
                    })}
                    className="input-field mt-1"
                    placeholder="Confirm your new password"
                  />
                  {errors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
                  )}
                </div>
                <div className="flex space-x-3 pt-4">
                  <button type="submit" className="btn-primary flex-1">
                    Change Password
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowChangePasswordModal(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
