import React from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { competitionsAPI } from '../services/api.firebase';
import { Calendar, MapPin, Users, Trophy, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

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


  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'published': return 'bg-green-100 text-green-800';
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-purple-100 text-purple-800';
      case 'closed': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (competition) => {
    const type = competition.competitionType || competition.type;
    switch (type) {
      case 'indoor': return '🏠';
      case 'outdoor': return '🌲';
      case 'precision': return '🎯';
      case 'speed': return '⚡';
      default: return '🏆';
    }
  };

  

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
      {/* Header */}
      <div className="text-center">
        <div className="mb-6">
          <img 
            src={`${process.env.PUBLIC_URL}/TheXringClassic.png`} 
            alt="The X-Ring Classic" 
            className="h-20 w-auto mx-auto object-contain"
          />
        </div>
        <h1 className="text-3xl font-bold text-white mb-4 drop-shadow-lg">Competitions</h1>
        <p className="text-white drop-shadow-md">Browse and join .22LR rifle competitions</p>
      </div>

      {/* Active Competitions Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Active Competitions</h2>
          <p className="text-white/80 text-sm">
            {(activeCompetitions?.data?.competitions || []).length} competition{(activeCompetitions?.data?.competitions || []).length !== 1 ? 's' : ''}
          </p>
        </div>

        {activeLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (activeCompetitions?.data?.competitions || []).length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(activeCompetitions.data.competitions || []).map((competition) => (
          <div key={competition.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
            {/* Competition Header */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">{getTypeIcon(competition)}</span>
                  <h3 className="text-lg font-semibold text-gray-900">{competition.title}</h3>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(competition.status)}`}>
                  {competition.status}
                </span>
              </div>
              
              <p className="text-gray-700 text-sm mb-4">{competition.description}</p>
              
              {/* Competition Details */}
              <div className="space-y-2 text-sm">
                              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-600" />
                <span className="text-gray-900">
                  {competition.schedule?.competitionDate 
                    ? new Date(competition.schedule.competitionDate).toLocaleDateString()
                    : competition.startDate 
                    ? new Date(competition.startDate).toLocaleDateString()
                    : 'TBD'
                  }
                </span>
              </div>
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-gray-600" />
                  <span className="text-gray-900">
                    {competition.range?.name || competition.location || 'TBD'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-gray-600" />
                  <span className="text-gray-900">
                    {(competition.participantCount || competition.registeredCount || 0)} / {competition.maxParticipants} participants
                  </span>
                </div>
              </div>
            </div>

            {/* Competition Footer */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium text-gray-900">${competition.prizePool || 0}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-gray-600" />
                  <span className="text-sm text-gray-700">{competition.duration || 'TBD'}</span>
                </div>
              </div>

              <div className="flex space-x-3">
                <button 
                  onClick={() => navigate(`/competitions/${competition.id}`)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  View Details
                </button>
                {competition.status === 'published' && (
                  <button 
                    onClick={() => registerMutation.mutate(competition.id)}
                    disabled={registerMutation.isLoading}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {registerMutation.isLoading ? 'Registering...' : 'Register'}
                  </button>
                )}
              </div>
            </div>
          </div>
            ))}
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
          <h2 className="text-2xl font-bold text-white">Past Competitions</h2>
          <p className="text-white/80 text-sm">
            {(pastCompetitions?.data?.competitions || []).length} competition{(pastCompetitions?.data?.competitions || []).length !== 1 ? 's' : ''}
          </p>
        </div>

        {pastLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (pastCompetitions?.data?.competitions || []).length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(pastCompetitions.data.competitions || []).map((competition) => (
              <div key={competition.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow opacity-90">
                {/* Competition Header */}
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">{getTypeIcon(competition)}</span>
                      <h3 className="text-lg font-semibold text-gray-900">{competition.title}</h3>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(competition.status)}`}>
                      {competition.status}
                    </span>
                  </div>
                  
                  <p className="text-gray-700 text-sm mb-4">{competition.description}</p>
                  
                  {/* Competition Details */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-gray-600" />
                      <span className="text-gray-900">
                        {competition.schedule?.competitionDate 
                          ? new Date(competition.schedule.competitionDate).toLocaleDateString()
                          : competition.startDate 
                          ? new Date(competition.startDate).toLocaleDateString()
                          : 'TBD'
                        }
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-gray-600" />
                      <span className="text-gray-900">
                        {competition.range?.name || competition.location || 'TBD'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-gray-600" />
                      <span className="text-gray-900">
                        {(competition.participantCount || competition.registeredCount || 0)} / {competition.maxParticipants} participants
                      </span>
                    </div>
                  </div>
                </div>

                {/* Competition Footer */}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <Trophy className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm font-medium text-gray-900">${competition.prizePool || 0}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-gray-600" />
                      <span className="text-sm text-gray-700">{competition.duration || 'TBD'}</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => navigate(`/competitions/${competition.id}`)}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    View Results
                  </button>
                </div>
              </div>
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
