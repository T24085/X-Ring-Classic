import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { competitionsAPI, scoresAPI } from '../services/api.firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Calendar, 
  MapPin, 
  Users, 
  Trophy, 
  Clock, 
  Target, 
  FileText, 
  CheckCircle, 
  XCircle,
  Edit,
  Trash2,
  Share,
  Download
} from 'lucide-react';
import toast from 'react-hot-toast';

const CompetitionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [justRegistered, setJustRegistered] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch competition details
  const { data: competition, isLoading, error } = useQuery(
    ['competition', id],
    async () => {
      const resp = await competitionsAPI.getById(id);
      return resp.data?.competition;
    },
    {
      staleTime: 5 * 60 * 1000,
    }
  );

  // Fetch competition scores
  const { data: rawScores } = useQuery(
    ['competition-scores', id],
    async () => {
      const resp = await scoresAPI.getByCompetition(id);
      return resp.data?.scores || [];
    },
    {
      staleTime: 2 * 60 * 1000,
    }
  );

  // Normalize scores to handle legacy/new API field names
  const scores = (rawScores || []).map((s) => ({
    id: s.id,
    userName: s.userName || (s.competitor ? (
      s.competitor.firstName && s.competitor.lastName
        ? `${s.competitor.firstName} ${s.competitor.lastName}`
        : s.competitor.username
    ) : 'Unknown'),
    totalScore: s.totalScore ?? s.score,
    status: s.status ?? (s.verificationStatus === 'approved' ? 'verified' : (s.verificationStatus || 'pending')),
    submittedAt: s.submittedAt || s.createdAt || s.updatedAt || new Date().toISOString(),
  }));

  // Registration mutation
  const registerMutation = useMutation(
    () => competitionsAPI.register(id),
    {
      onSuccess: () => {
        toast.success('Successfully registered for competition!');
        queryClient.invalidateQueries(['competition', id]);
        setJustRegistered(true);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to register');
      },
    }
  );

  // Delete competition mutation (admin only)
  const deleteMutation = useMutation(
    () => competitionsAPI.delete(id),
    {
      onSuccess: () => {
        toast.success('Competition deleted successfully');
        navigate('/competitions');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to delete competition');
      },
    }
  );

  const handleRegister = () => {
    if (!user) {
      toast.error('Please log in to register for competitions');
      return;
    }
    registerMutation.mutate();
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this competition? This action cannot be undone.')) {
      deleteMutation.mutate();
    }
  };

  const isRegistered = competition?.participants?.some(p => p.userId === user?.id);
  const isAdmin = user?.role === 'admin' || user?.role === 'range_admin';
  const isOwner = competition?.createdBy === user?.id;

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
        <div className="text-red-600 mb-4">Error loading competition</div>
        <button 
          onClick={() => navigate('/competitions')} 
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Back to Competitions
        </button>
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-600 mb-4">Competition not found</div>
        <button 
          onClick={() => navigate('/competitions')} 
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Back to Competitions
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <span className="text-3xl">
                {(competition.competitionType || competition.type) === 'indoor' ? '🏠' : 
                 (competition.competitionType || competition.type) === 'outdoor' ? '🌲' : '🏆'}
              </span>
              <h1 className="text-3xl font-bold text-gray-900">{competition.title}</h1>
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                competition.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                competition.status === 'published' ? 'bg-green-100 text-green-800' :
                competition.status === 'active' ? 'bg-blue-100 text-blue-800' :
                'bg-purple-100 text-purple-800'
              }`}>
                {competition.status}
              </span>
            </div>
            <p className="text-gray-600 text-lg">{competition.description}</p>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2">
            {isAdmin && (
              <>
                <button
                  onClick={() => navigate(`/competitions/${id}/edit`)}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit Competition"
                >
                  <Edit className="h-5 w-5" />
                </button>
                <button
                  onClick={handleDelete}
                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete Competition"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </>
            )}
            <button
              onClick={() => navigator.share?.({ title: competition.title, url: window.location.href })}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Share Competition"
            >
              <Share className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Competition Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-600">Date</p>
              <p className="font-medium">
                {competition.schedule?.competitionDate 
                  ? new Date(competition.schedule.competitionDate).toLocaleDateString()
                  : competition.startDate 
                  ? new Date(competition.startDate).toLocaleDateString()
                  : 'TBD'
                }
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <MapPin className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-600">Location</p>
              <p className="font-medium">{competition.range?.name || competition.location || 'TBD'}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-600">Participants</p>
              <p className="font-medium">{(competition.participantCount || competition.registeredCount || 0)} / {competition.maxParticipants}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Trophy className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-600">Prize Pool</p>
              <p className="font-medium">${competition.prizePool || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Registration Button */}
      {(competition.status === 'published' || competition.status === 'active') && !isRegistered && !justRegistered && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-blue-900">Ready to compete?</h3>
              <p className="text-blue-700">Register now to participate in this competition</p>
            </div>
            <button
              onClick={handleRegister}
              disabled={registerMutation.isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {registerMutation.isLoading ? 'Registering...' : 'Register Now'}
            </button>
          </div>
        </div>
      )}

      {(isRegistered || justRegistered) && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-green-800 font-medium">You are registered for this competition</span>
            </div>
            <button
              onClick={() => navigate(`/submit-score/${id}`)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Report Score
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { key: 'overview', label: 'Overview', icon: Target },
              { key: 'participants', label: 'Participants', icon: Users },
              { key: 'scores', label: 'Scores', icon: Trophy },
              { key: 'rules', label: 'Rules', icon: FileText }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Competition Details</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Type:</span>
                      <span className="font-medium capitalize">{competition.competitionType || competition.type || 'TBD'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Duration:</span>
                      <span className="font-medium">{competition.duration || 'TBD'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Distance:</span>
                      <span className="font-medium">
                        {competition.maxDistance ? `${competition.maxDistance} yards` : competition.distance || 'TBD'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Format:</span>
                      <span className="font-medium capitalize">{competition.format || 'TBD'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Shots per Target:</span>
                      <span className="font-medium">{competition.shotsPerTarget || 'TBD'}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Schedule</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Registration Deadline:</span>
                      <span className="font-medium">
                        {competition.schedule?.registrationDeadline 
                          ? new Date(competition.schedule.registrationDeadline).toLocaleDateString()
                          : competition.registrationDeadline 
                          ? new Date(competition.registrationDeadline).toLocaleDateString()
                          : 'TBD'
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Start Time:</span>
                      <span className="font-medium">
                        {competition.schedule?.startTime || competition.startTime || 'TBD'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">End Time:</span>
                      <span className="font-medium">
                        {competition.schedule?.endTime || competition.endTime || 'TBD'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {competition.additionalInfo && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Additional Information</h3>
                  <p className="text-gray-700">{competition.additionalInfo}</p>
                </div>
              )}
            </div>
          )}

          {/* Participants Tab */}
          {activeTab === 'participants' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Registered Participants</h3>
                <span className="text-sm text-gray-500">
                  {competition.participants?.length || 0} of {competition.maxParticipants}
                </span>
              </div>
              
              {competition.participants && competition.participants.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {competition.participants.map((participant) => (
                    <div key={participant.userId} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-700">
                            {participant.userName?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{participant.userName}</p>
                          <p className="text-sm text-gray-500">{participant.location}</p>
                        </div>
                      </div>
                      <div className="mt-3 text-sm text-gray-600">
                        Registered: {new Date(participant.registeredAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No participants registered yet</p>
                </div>
              )}
            </div>
          )}

          {/* Scores Tab */}
          {activeTab === 'scores' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Competition Scores</h3>
                {scores && scores.length > 0 && (
                  <button className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <Download className="h-4 w-4" />
                    <span>Export Scores</span>
                  </button>
                )}
              </div>

              {scores && scores.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shooter</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {scores.map((score, index) => (
                        <tr key={score.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            #{index + 1}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center mr-3">
                                <span className="text-xs font-medium text-gray-700">
                                  {score.userName?.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <span className="text-sm font-medium text-gray-900">{score.userName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {score.totalScore?.toFixed(1)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              score.status === 'verified' ? 'bg-green-100 text-green-800' :
                              score.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {score.status === 'verified' ? (
                                <CheckCircle className="h-3 w-3 mr-1" />
                              ) : score.status === 'rejected' ? (
                                <XCircle className="h-3 w-3 mr-1" />
                              ) : null}
                              {score.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(score.submittedAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No scores submitted yet</p>
                </div>
              )}
            </div>
          )}

          {/* Rules Tab */}
          {activeTab === 'rules' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Competition Rules</h3>
              {competition.rules ? (
                <div className="prose max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: competition.rules }} />
                </div>
              ) : (
                <p className="text-gray-600">No specific rules have been defined for this competition.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompetitionDetail;
