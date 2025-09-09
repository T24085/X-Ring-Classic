import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { competitionsAPI } from '../services/api';
import { Search, Calendar, MapPin, Users, Trophy, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

const Competitions = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [filters, setFilters] = useState({
    search: '',
    type: 'all',
    status: 'all',
    location: 'all'
  });

  const { data: competitions, isLoading, error } = useQuery(
    ['competitions', filters],
    async () => {
             const response = await competitionsAPI.getAll(filters);
       return response.data;
    },
    {
      keepPreviousData: true,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

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

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'published': return 'bg-green-100 text-green-800';
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-purple-100 text-purple-800';
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
            src="/TheXringClassic.png" 
            alt="The X-Ring Classic" 
            className="h-20 w-auto mx-auto object-contain"
          />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Competitions</h1>
        <p className="text-gray-600">Browse and join .22LR rifle competitions</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search competitions..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Type Filter */}
          <select
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Types</option>
            <option value="indoor">Indoor</option>
            <option value="outdoor">Outdoor</option>
            <option value="precision">Precision</option>
            <option value="speed">Speed</option>
          </select>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="published">Published</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>

          {/* Location Filter */}
          <select
            value={filters.location}
            onChange={(e) => handleFilterChange('location', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Locations</option>
            <option value="local">Local</option>
            <option value="regional">Regional</option>
            <option value="national">National</option>
          </select>
        </div>
      </div>

      

       {/* Competitions Grid */}
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {competitions?.competitions?.map((competition) => (
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
              
              <p className="text-gray-600 text-sm mb-4">{competition.description}</p>
              
              {/* Competition Details */}
              <div className="space-y-2 text-sm text-gray-500">
                              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4" />
                <span>
                  {competition.schedule?.competitionDate 
                    ? new Date(competition.schedule.competitionDate).toLocaleDateString()
                    : competition.startDate 
                    ? new Date(competition.startDate).toLocaleDateString()
                    : 'TBD'
                  }
                </span>
              </div>
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4" />
                  <span>
                    {competition.range?.name || competition.location || 'TBD'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4" />
                  <span>
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
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-500">{competition.duration || 'TBD'}</span>
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

      {/* Empty State */}
      {(!competitions?.competitions || competitions.competitions.length === 0) && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Trophy className="h-16 w-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No competitions found</h3>
          <p className="text-gray-600">Try adjusting your filters or check back later for new competitions.</p>
        </div>
      )}
    </div>
  );
};

export default Competitions;
