import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { competitionsAPI } from '../services/api';
import { Target, MapPin, AlertCircle, CheckCircle, Save } from 'lucide-react';
import toast from 'react-hot-toast';

const EditCompetition = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm();

  // Load existing competition
  const { data, isLoading, error } = useQuery(['competition', id], () => competitionsAPI.getById(id), {
    onSuccess: (resp) => {
      const c = resp?.data?.competition || {};
      // Map competition into form values
      reset({
        title: c.title || '',
        description: c.description || '',
        type: c.competitionType || c.type || 'indoor',
        status: c.status || 'draft',
        location: c.range?.name || c.location || '',
        startDate: c.schedule?.competitionDate ? new Date(c.schedule.competitionDate).toISOString().slice(0,10) : '',
        endDate: c.schedule?.competitionDate ? new Date(c.schedule.competitionDate).toISOString().slice(0,10) : '',
        startTime: c.schedule?.startTime || '09:00',
        endTime: c.schedule?.endTime || '17:00',
        registrationDeadline: c.schedule?.registrationDeadline ? new Date(c.schedule.registrationDeadline).toISOString().slice(0,10) : '',
        distance: c.distance || (c.maxDistance ? `${c.maxDistance} yards` : ''),
        shotsPerTarget: c.shotsPerTarget || 10,
        duration: c.duration || '4 hours',
        format: c.format || 'precision',
        maxParticipants: c.maxParticipants || c.registeredCount || 50,
        prizePool: c.prizePool || 0,
        rules: c.rules || '',
        equipment: c.equipment || ''
      });
    }
  });

  const updateMutation = useMutation(
    (payload) => competitionsAPI.update(id, payload),
    {
      onSuccess: (resp) => {
        toast.success('Competition updated');
        queryClient.invalidateQueries(['competition', id]);
        queryClient.invalidateQueries(['featured-competitions']);
        navigate(`/competitions/${id}`);
      },
      onError: (err) => {
        toast.error(err.response?.data?.error || 'Failed to update competition');
        setIsSubmitting(false);
      }
    }
  );

  const onSubmit = async (form) => {
    setIsSubmitting(true);
    const payload = {
      title: form.title,
      description: form.description,
      competitionType: form.type,
      format: form.format,
      status: form.status,
      range: { name: form.location, address: form.location, location: form.location },
      schedule: {
        competitionDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
        startTime: form.startTime || '09:00',
        endTime: form.endTime || '17:00',
        registrationDeadline: form.registrationDeadline ? new Date(form.registrationDeadline).toISOString() : undefined
      },
      distance: form.distance,
      shotsPerTarget: parseInt(form.shotsPerTarget) || 10,
      maxParticipants: parseInt(form.maxParticipants) || 50,
      prizePool: parseFloat(form.prizePool) || 0,
      rules: form.rules,
      equipment: form.equipment
    };
    // Remove undefined subfields
    if (!payload.schedule.competitionDate) delete payload.schedule.competitionDate;
    if (!payload.schedule.registrationDeadline) delete payload.schedule.registrationDeadline;

    await updateMutation.mutateAsync(payload);
  };

  const watchedStatus = watch('status');

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
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Edit Competition</h1>
          <p className="text-gray-600">Update competition details</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
          watchedStatus === 'draft' ? 'bg-yellow-100 text-yellow-800' :
          watchedStatus === 'published' ? 'bg-green-100 text-green-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {watchedStatus}
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
              <input type="text" {...register('title', { required: 'Title is required' })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              {errors.title && (<p className="text-red-600 text-sm mt-1">{errors.title.message}</p>)}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type *</label>
              <select {...register('type', { required: 'Type is required' })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="indoor">Indoor</option>
                <option value="outdoor">Outdoor</option>
                <option value="speed">Speed</option>
                <option value="precision">Precision</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
              <textarea rows={3} {...register('description', { required: 'Description is required' })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              {errors.description && (<p className="text-red-600 text-sm mt-1">{errors.description.message}</p>)}
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Location *</label>
              <input type="text" {...register('location', { required: 'Location is required' })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              {errors.location && (<p className="text-red-600 text-sm mt-1">{errors.location.message}</p>)}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input type="date" {...register('startDate')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
              <input type="time" {...register('startTime')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
              <input type="time" {...register('endTime')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Registration Deadline</label>
              <input type="date" {...register('registrationDeadline')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Target className="w-5 h-5 mr-2" />
            Competition Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Distance</label>
              <input type="text" {...register('distance')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Shots Per Target</label>
              <input type="number" {...register('shotsPerTarget', { min: { value: 1, message: 'Must be at least 1' } })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              {errors.shotsPerTarget && (<p className="text-red-600 text-sm mt-1">{errors.shotsPerTarget.message}</p>)}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
              <input type="text" {...register('duration')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
              <select {...register('format')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="precision">Precision</option>
                <option value="speed">Speed</option>
                <option value="multi-stage">Multi-Stage</option>
                <option value="team">Team</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Max Participants</label>
              <input type="number" {...register('maxParticipants', { min: { value: 1, message: 'Must be at least 1' } })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              {errors.maxParticipants && (<p className="text-red-600 text-sm mt-1">{errors.maxParticipants.message}</p>)}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Prize Pool ($)</label>
              <input type="number" {...register('prizePool', { min: { value: 0, message: 'Must be 0 or greater' } })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>
        </div>

        {/* Rules & Status */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            Rules & Status
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Competition Rules</label>
              <textarea rows={4} {...register('rules')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Equipment Requirements</label>
              <textarea rows={4} {...register('equipment')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Competition Status</label>
              <select {...register('status')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-6 border-t border-gray-200">
          <button type="button" onClick={() => navigate(-1)} className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center">
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditCompetition;

