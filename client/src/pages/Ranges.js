import React from 'react';
import { useQuery } from 'react-query';
import { rangesAPI } from '../services/api.firebase';
import { 
  MapPin, 
  Phone, 
  Mail, 
  Globe,
  Building2
} from 'lucide-react';

const Ranges = () => {
  const { data: rangesData, isLoading, error } = useQuery(
    'public-ranges',
    () => rangesAPI.getAll({ active: true }),
    {
      staleTime: 10 * 60 * 1000, // 10 minutes
    }
  );

  const ranges = rangesData?.data?.ranges || [];

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
        <div className="text-red-600 mb-4">Error loading ranges</div>
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
        <h1 className="text-3xl font-bold text-white mb-4 drop-shadow-lg">Participating Ranges</h1>
        <p className="text-white drop-shadow-md">
          Discover the shooting ranges that are part of the X-Ring Classic competition network
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Building2 className="w-8 h-8 text-blue-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Ranges</p>
              <p className="text-2xl font-bold text-gray-900">{ranges.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <MapPin className="w-8 h-8 text-green-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Locations</p>
              <p className="text-2xl font-bold text-gray-900">
                {new Set(ranges.map(r => r.state)).size}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Globe className="w-8 h-8 text-purple-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Network Coverage</p>
              <p className="text-2xl font-bold text-gray-900">Growing</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ranges Grid */}
      {ranges.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No ranges available yet</h3>
          <p className="text-gray-600">Check back soon as we expand our network of participating ranges.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ranges.map((range) => (
            <div key={range.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Building2 className="w-6 h-6 text-blue-500" />
                    <h3 className="text-lg font-semibold text-gray-900">{range.name}</h3>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <MapPin className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
                    <div className="text-sm text-gray-600">
                      <p>{range.address}</p>
                      <p>{range.city}, {range.state} {range.zipCode}</p>
                    </div>
                  </div>

                  {range.phone && (
                    <div className="flex items-center space-x-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <a href={`tel:${range.phone}`} className="text-sm text-gray-600 hover:text-blue-600">
                        {range.phone}
                      </a>
                    </div>
                  )}

                  {range.email && (
                    <div className="flex items-center space-x-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <a href={`mailto:${range.email}`} className="text-sm text-gray-600 hover:text-blue-600">
                        {range.email}
                      </a>
                    </div>
                  )}

                  {range.website && (
                    <div className="flex items-center space-x-2">
                      <Globe className="w-4 h-4 text-gray-400" />
                      <a 
                        href={range.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Visit Website
                      </a>
                    </div>
                  )}

                  {range.description && (
                    <p className="text-sm text-gray-600 mt-3 line-clamp-3">{range.description}</p>
                  )}

                  {range.facilities && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs font-medium text-gray-500 uppercase mb-1">Facilities</p>
                      <p className="text-sm text-gray-600">{range.facilities}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Ranges;

