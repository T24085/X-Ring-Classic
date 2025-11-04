import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useQuery } from 'react-query';
import { usersAPI } from '../services/api.firebase';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import RankLogo from '../components/RankLogo';
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
  XMarkIcon
} from '@heroicons/react/24/outline';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [shotsModalScore, setShotsModalScore] = useState(null);

  // Debug logging
  console.log('Profile component - user:', user);

  // Function to get classification badge styles
  const getClassStyles = (classification) => {
    switch ((classification || '').toLowerCase()) {
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
    reset
  } = useForm();

  // Fetch user's competition history and statistics
  const { data: userStats, isLoading: statsLoading } = useQuery(
    ['user-stats', user?.id],
    async () => {
      if (!user?.id) return null;
      const resp = await usersAPI.getScores(user.id);
      return resp.data;
    },
    { enabled: !!user?.id }
  );

  const { data: userCompetitions, isLoading: competitionsLoading } = useQuery(
    ['user-competitions', user?.id],
    async () => {
      if (!user?.id) return null;
      const resp = await usersAPI.getCompetitions(user.id);
      return resp.data;
    },
    { enabled: !!user?.id }
  );

  const handleProfileUpdate = async (data) => {
    try {
      const result = await usersAPI.updateProfile(data);
      updateUser(result.user);
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

  const tabs = [
    { id: 'overview', name: 'Overview', icon: UserIcon },
    { id: 'statistics', name: 'Statistics', icon: ChartBarIcon },
    { id: 'history', name: 'Competition History', icon: CalendarIcon },
    { id: 'settings', name: 'Settings', icon: CogIcon }
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
                    {user.classification}
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
          <button
            onClick={() => setIsEditing(true)}
            className="btn-secondary flex items-center space-x-2"
          >
            <PencilIcon className="w-4 h-4" />
            <span>Edit Profile</span>
          </button>
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
                    <div className="text-2xl font-bold text-rifle-900">{user.classification}</div>
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
      {isEditing && (
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

  // Helpers
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
  // Sort scores newest-first and show full history
  const sortedScores = [...scores].sort((a, b) => {
    const ad = new Date(a?.createdAt || a?.submittedAt || a?.date || 0).getTime();
    const bd = new Date(b?.createdAt || b?.submittedAt || b?.date || 0).getTime();
    return bd - ad;
  });
  const totalScores = scores.length;
  const totalCompetitions = new Set(scores.map(s => s.competitionId)).size;
  const avgScore = totalScores > 0 ? Math.round(scores.reduce((sum, s) => sum + toNumberScore(s), 0) / totalScores) : 0;
  const bestIndoor = scores
    .filter(s => s?.competition?.competitionType === 'indoor')
    .reduce((max, s) => Math.max(max, toNumberScore(s)), 0);
  const bestOutdoor = scores
    .filter(s => s?.competition?.competitionType === 'outdoor')
    .reduce((max, s) => Math.max(max, toNumberScore(s)), 0);

  const renderStatistics = () => (
    <div className="space-y-6">
      {/* Performance Overview */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-rifle-600">{avgScore || user?.averageScore || 0}</div>
            <div className="text-sm text-gray-600">Average Score</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-rifle-600">{bestIndoor || user?.personalBestIndoor || 0}</div>
            <div className="text-sm text-gray-600">Personal Best (Indoor)</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-rifle-600">{bestOutdoor || user?.personalBestOutdoor || 0}</div>
            <div className="text-sm text-gray-600">Personal Best (Outdoor)</div>
          </div>
          <div className="text-center">
            {user?.classification && user.classification !== 'Unclassified' ? (
              <>
                <div className="flex items-center justify-center mb-2">
                  <RankLogo classification={user.classification} size={32} />
                </div>
                <div className="text-lg font-bold text-rifle-600">{user.classification}</div>
                <div className="text-sm text-gray-600">Current Rank</div>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-gray-400">—</div>
                <div className="text-sm text-gray-600">No Rank Yet</div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Recent Performance */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Performance</h3>
        {statsLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rifle-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading statistics...</p>
          </div>
        ) : scores.length > 0 ? (
          <div className="space-y-4">
            {sortedScores.map((score) => (
              <div key={score.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-semibold text-gray-900">{score.competition?.title}</div>
                  <div className="text-sm text-gray-600">{formatDate(score.createdAt)}</div>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setShotsModalScore(score)}
                    className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100"
                  >
                    View Shots
                  </button>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-rifle-600">{toNumberScore(score)}</div>
                    <div className="text-sm text-gray-600">
                      {(score.verificationStatus || 'approved') === 'approved' ? 'Approved' : (score.verificationStatus || 'Pending')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      ) : (
          <div className="text-center py-8">
            <TrophyIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No scores submitted yet</p>
            <p className="text-sm text-gray-500">Participate in competitions to see your statistics</p>
          </div>
        )}
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
              <div className="text-3xl font-bold text-rifle-900 mb-2">{user.classification}</div>
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
            <button className="btn-secondary">
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
  if (!user) {
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
        <h1 className="text-3xl font-bold text-white mb-4 drop-shadow-lg">Profile</h1>
        <p className="text-white drop-shadow-md">Manage your account and view your statistics</p>
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
    </div>
  );
};

export default Profile;
