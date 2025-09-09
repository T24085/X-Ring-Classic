import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { competitionsAPI, adminAPI } from '../services/api';
import { useForm } from 'react-hook-form';
import { 
  Save, 
  Calendar, 
  MapPin, 
  Users, 
  DollarSign, 
  Target, 
  Clock,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

const CreateCompetition = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

  const { register, handleSubmit, formState: { errors }, watch, reset, setValue } = useForm({
    defaultValues: {
      title: '',
      description: '',
      type: 'indoor',
      status: 'draft',
      rangeName: '',
      rangeLocation: '',
      startDate: '',
      endDate: '',
      maxParticipants: 50,
      prizePool: 0,
      duration: '4 hours',
      distance: '25 yards',
      shotsPerTarget: 10,
      format: 'precision',
      rules: '',
      equipment: '',
      registrationDeadline: ''
    }
  });

  const createCompetitionMutation = useMutation(
    (competitionData) => competitionsAPI.create(competitionData),
    {
      onSuccess: (data) => {
        toast.success('Competition created successfully!');
        queryClient.invalidateQueries('competitions');
        navigate(`/competitions/${data.competition.id}`);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to create competition');
        setIsSubmitting(false);
      },
    }
  );

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    
    try {
      const competitionData = {
        title: data.title,
        description: data.description,
        competitionType: data.type === 'speed' || data.type === 'precision' ? 'indoor' : data.type,
        maxDistance: data.type === 'speed' ? 25 : 50,
        format: data.type === 'speed' ? 'standing' : data.type === 'precision' ? 'benchrest' : 'prone',
        schedule: {
          competitionDate: new Date(data.startDate).toISOString(),
          startTime: data.startTime || '09:00',
          endTime: data.endTime || '17:00',
          registrationDeadline: new Date(data.registrationDeadline).toISOString()
        },
        range: {
          name: data.rangeName,
          address: data.rangeLocation,
          location: data.rangeLocation
        },
        maxParticipants: parseInt(data.maxParticipants) || 100,
        prizePool: parseFloat(data.prizePool) || 0,
        shotsPerTarget: parseInt(data.shotsPerTarget) || 10,
        status: data.status || 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        registeredCount: 0,
        participants: []
      };

      await createCompetitionMutation.mutateAsync(competitionData);
    } catch (error) {
      console.error('Error creating competition:', error);
    }
  };

  const watchedType = watch('type');
  const watchedStatus = watch('status');

  // If range admin, prefill their range
  useEffect(() => {
    if (user?.role === 'range_admin') {
      if (user?.rangeName) setValue('rangeName', user.rangeName);
      if (user?.rangeLocation) setValue('rangeLocation', user.rangeLocation);
    }
  }, [user, setValue]);

  // Fetch range admins for admin users to choose a range
  const { data: rangeAdminsData } = useQuery(
    ['range-admins-for-competition'],
    () => adminAPI.getRangeAdmins(),
    { enabled: user?.role === 'admin', staleTime: 5 * 60 * 1000 }
  );
  const rangeAdmins = rangeAdminsData?.rangeAdmins || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Create Competition</h1>
          <p className="text-gray-600">Set up a new .22LR rifle competition</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            watchedStatus === 'draft' ? 'bg-yellow-100 text-yellow-800' :
            watchedStatus === 'published' ? 'bg-green-100 text-green-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {watchedStatus === 'draft' ? 'Draft' : 
             watchedStatus === 'published' ? 'Published' : watchedStatus}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Basic Information */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Target className="w-5 h-5 mr-2" />
            Basic Information
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Competition Title *
              </label>
              <input
                type="text"
                {...register('title', { required: 'Title is required' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Spring Indoor Championship"
              />
              {errors.title && (
                <p className="text-red-600 text-sm mt-1">{errors.title.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Competition Type *
              </label>
              <select
                {...register('type', { required: 'Type is required' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="indoor">Indoor</option>
                <option value="outdoor">Outdoor</option>
                <option value="speed">Speed Shooting</option>
                <option value="precision">Precision</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                {...register('description', { required: 'Description is required' })}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe the competition format, rules, and what participants can expect..."
              />
              {errors.description && (
                <p className="text-red-600 text-sm mt-1">{errors.description.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Location & Schedule */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <MapPin className="w-5 h-5 mr-2" />
            Location & Schedule
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {user?.role === 'admin' && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Range</label>
                <select
                  onChange={(e) => {
                    const selected = rangeAdmins.find(r => r.id === e.target.value);
                    if (selected) {
                      setValue('rangeName', selected.rangeName || '');
                      setValue('rangeLocation', selected.rangeLocation || '');
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Choose a range admin… (optional)</option>
                  {rangeAdmins.map((ra) => (
                    <option key={ra.id} value={ra.id}>
                      {ra.rangeName} — {ra.rangeLocation} (by {ra.firstName} {ra.lastName})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Selecting a range fills the fields below. You can still edit them.</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Range Name *</label>
              <input
                type="text"
                {...register('rangeName', { required: 'Range name is required' })}
                defaultValue={user?.role === 'range_admin' ? (user?.rangeName || '') : ''}
                disabled={user?.role === 'range_admin' && !!user?.rangeName}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Central Range Complex"
              />
              {errors.rangeName && (<p className="text-red-600 text-sm mt-1">{errors.rangeName.message}</p>)}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Range Location / Address *</label>
              <input
                type="text"
                {...register('rangeLocation', { required: 'Range location is required' })}
                defaultValue={user?.role === 'range_admin' ? (user?.rangeLocation || '') : ''}
                disabled={user?.role === 'range_admin' && !!user?.rangeLocation}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="City, State or full address"
              />
              {errors.rangeLocation && (<p className="text-red-600 text-sm mt-1">{errors.rangeLocation.message}</p>)}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date *
              </label>
              <input
                type="date"
                {...register('startDate', { required: 'Start date is required' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {errors.startDate && (
                <p className="text-red-600 text-sm mt-1">{errors.startDate.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Time *
              </label>
              <input
                type="time"
                {...register('startTime', { required: 'Start time is required' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                defaultValue="09:00"
              />
              {errors.startTime && (
                <p className="text-red-600 text-sm mt-1">{errors.startTime.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date *
              </label>
              <input
                type="date"
                {...register('endDate', { required: 'End date is required' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {errors.endDate && (
                <p className="text-red-600 text-sm mt-1">{errors.endDate.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Time *
              </label>
              <input
                type="time"
                {...register('endTime', { required: 'End time is required' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                defaultValue="17:00"
              />
              {errors.endTime && (
                <p className="text-red-600 text-sm mt-1">{errors.endTime.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Registration Deadline *
              </label>
              <input
                type="date"
                {...register('registrationDeadline', { required: 'Registration deadline is required' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {errors.registrationDeadline && (
                <p className="text-red-600 text-sm mt-1">{errors.registrationDeadline.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Competition Details */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Target className="w-5 h-5 mr-2" />
            Competition Details
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Distance *
              </label>
              <input
                type="text"
                {...register('distance', { required: 'Distance is required' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 25 yards"
              />
              {errors.distance && (
                <p className="text-red-600 text-sm mt-1">{errors.distance.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Shots Per Target *
              </label>
              <input
                type="number"
                {...register('shotsPerTarget', { 
                  required: 'Shots per target is required',
                  min: { value: 1, message: 'Must be at least 1' }
                })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="10"
              />
              {errors.shotsPerTarget && (
                <p className="text-red-600 text-sm mt-1">{errors.shotsPerTarget.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration *
              </label>
              <input
                type="text"
                {...register('duration', { required: 'Duration is required' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 4 hours"
              />
              {errors.duration && (
                <p className="text-red-600 text-sm mt-1">{errors.duration.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Format *
              </label>
              <select
                {...register('format', { required: 'Format is required' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="precision">Precision</option>
                <option value="speed">Speed</option>
                <option value="multi-stage">Multi-Stage</option>
                <option value="team">Team</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Participants *
              </label>
              <input
                type="number"
                {...register('maxParticipants', { 
                  required: 'Max participants is required',
                  min: { value: 1, message: 'Must be at least 1' }
                })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="50"
              />
              {errors.maxParticipants && (
                <p className="text-red-600 text-sm mt-1">{errors.maxParticipants.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prize Pool ($) *
              </label>
              <input
                type="number"
                {...register('prizePool', { 
                  required: 'Prize pool is required',
                  min: { value: 0, message: 'Must be 0 or greater' }
                })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="1000"
              />
              {errors.prizePool && (
                <p className="text-red-600 text-sm mt-1">{errors.prizePool.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Rules & Equipment */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            Rules & Equipment
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Competition Rules
              </label>
              <textarea
                {...register('rules')}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Specify competition rules, scoring methods, and any special requirements..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Equipment Requirements
              </label>
              <textarea
                {...register('equipment')}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="List required equipment, allowed modifications, and any restrictions..."
              />
            </div>
          </div>
        </div>

        {/* Status & Actions */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <CheckCircle className="w-5 h-5 mr-2" />
            Status & Actions
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Competition Status *
              </label>
              <select
                {...register('status', { required: 'Status is required' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="draft">Draft (Not visible to public)</option>
                <option value="published">Published (Visible to public)</option>
                <option value="active">Active (Registration open)</option>
                <option value="closed">Closed (Registration closed)</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="flex items-end">
              <div className="text-sm text-gray-600">
                <p>• <strong>Draft:</strong> Save for later editing</p>
                <p>• <strong>Published:</strong> Make visible to all users</p>
                <p>• <strong>Active:</strong> Allow registrations</p>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/admin/competitions')}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={() => {
                reset();
                toast.success('Form reset to defaults');
              }}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Reset
            </button>
            
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Create Competition
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CreateCompetition;
