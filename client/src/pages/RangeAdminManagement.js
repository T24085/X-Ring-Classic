import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { adminAPI, rangesAPI } from '../services/api.firebase';
import { 
  Plus, 
  User, 
  MapPin, 
  Phone, 
  Mail, 
  Shield, 
  Trash2,
  Edit,
  Eye,
  Building2
} from 'lucide-react';
import toast from 'react-hot-toast';

const RangeAdminManagement = () => {
  const [activeTab, setActiveTab] = useState('admins'); // 'admins' or 'ranges'
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCreateRangeForm, setShowCreateRangeForm] = useState(false);
  const [selectedRangeAdmin, setSelectedRangeAdmin] = useState(null);
  const [selectedRange, setSelectedRange] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    rangeName: '',
    rangeLocation: '',
    phone: ''
  });
  const [rangeFormData, setRangeFormData] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    phone: '',
    email: '',
    website: '',
    description: '',
    facilities: '',
    contactName: '',
    contactEmail: '',
    contactPhone: ''
  });
  const queryClient = useQueryClient();

  const { data: rangeAdmins, isLoading, error } = useQuery(
    'range-admins',
    () => adminAPI.getRangeAdmins(),
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: true,
      refetchOnMount: true,
    }
  );

  const { data: rangesData, isLoading: rangesLoading } = useQuery(
    'ranges',
    () => rangesAPI.getAll({ active: true }),
    {
      staleTime: 5 * 60 * 1000,
    }
  );

  const createRangeAdminMutation = useMutation(
    (data) => adminAPI.createRangeAdmin(data),
    {
      onSuccess: () => {
        toast.success('Range admin account created successfully');
        queryClient.invalidateQueries(['range-admins']);
        queryClient.refetchQueries(['range-admins']);
        setShowCreateForm(false);
        setFormData({
          username: '',
          email: '',
          password: '',
          firstName: '',
          lastName: '',
          rangeName: '',
          rangeLocation: '',
          phone: ''
        });
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to create range admin account');
      }
    }
  );

  const createRangeMutation = useMutation(
    (data) => rangesAPI.create(data),
    {
      onSuccess: () => {
        toast.success('Range created successfully');
        queryClient.invalidateQueries(['ranges']);
        setShowCreateRangeForm(false);
        setRangeFormData({
          name: '',
          address: '',
          city: '',
          state: '',
          zipCode: '',
          phone: '',
          email: '',
          website: '',
          description: '',
          facilities: '',
          contactName: '',
          contactEmail: '',
          contactPhone: ''
        });
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to create range');
      }
    }
  );

  const updateRangeMutation = useMutation(
    ({ id, data }) => rangesAPI.update(id, data),
    {
      onSuccess: () => {
        toast.success('Range updated successfully');
        queryClient.invalidateQueries(['ranges']);
        setSelectedRange(null);
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to update range');
      }
    }
  );

  const deleteRangeMutation = useMutation(
    (id) => rangesAPI.delete(id),
    {
      onSuccess: () => {
        toast.success('Range deactivated successfully');
        queryClient.invalidateQueries(['ranges']);
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to deactivate range');
      }
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    createRangeAdminMutation.mutate(formData);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleRangeInputChange = (e) => {
    const { name, value } = e.target;
    setRangeFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCreateRange = (e) => {
    e.preventDefault();
    createRangeMutation.mutate(rangeFormData);
  };

  const handleUpdateRange = (e) => {
    e.preventDefault();
    if (!selectedRange) return;
    updateRangeMutation.mutate({ id: selectedRange.id, data: rangeFormData });
  };

  const handleDeleteRange = (rangeId) => {
    if (window.confirm('Are you sure you want to deactivate this range? It will no longer appear in competition creation.')) {
      deleteRangeMutation.mutate(rangeId);
    }
  };

  if (isLoading || rangesLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-4">Error loading data</div>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  const rangeAdminsList = rangeAdmins?.data?.rangeAdmins || rangeAdmins?.rangeAdmins || [];
  
  // Debug logging
  console.log('Range admins data:', rangeAdmins);
  console.log('Range admins data.rangeAdmins:', rangeAdmins?.rangeAdmins);
  console.log('Range admins data.data.rangeAdmins:', rangeAdmins?.data?.rangeAdmins);
  console.log('Range admins list:', rangeAdminsList);
  console.log('List length:', rangeAdminsList.length);

  const ranges = rangesData?.data?.ranges || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-4 drop-shadow-lg">Range Management</h1>
          <p className="text-xl text-white drop-shadow-md">
            Manage range admin accounts and shooting ranges
          </p>
        </div>
        {activeTab === 'admins' ? (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            <span>Create Range Admin</span>
          </button>
        ) : (
          <button
            onClick={() => setShowCreateRangeForm(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            <span>Add Range</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('admins')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'admins'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4" />
                <span>Range Admins</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('ranges')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'ranges'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Building2 className="w-4 h-4" />
                <span>Ranges</span>
              </div>
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'admins' ? (
            <>
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center">
                    <Shield className="w-8 h-8 text-blue-500" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Range Admins</p>
                      <p className="text-2xl font-bold text-gray-900">{rangeAdminsList.length}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center">
                    <User className="w-8 h-8 text-green-500" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Active</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {rangeAdminsList.filter(admin => admin.isActive !== false).length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Range Admins List */}
              <div className="bg-white rounded-lg border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Range Admin Accounts</h2>
        </div>
        
        {rangeAdminsList.length === 0 ? (
          <div className="p-8 text-center">
            <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No range admin accounts created yet</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create First Range Admin
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {rangeAdminsList.map((admin) => (
              <div key={admin.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 mb-4">
                      <div className="flex items-center space-x-2">
                        <Shield className="w-5 h-5 text-blue-500" />
                        <span className="text-lg font-semibold text-gray-900">
                          {admin.firstName} {admin.lastName}
                        </span>
                        <span className="text-sm text-gray-500">
                          (@{admin.username})
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{admin.rangeName}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="flex items-center space-x-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{admin.email}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{admin.rangeLocation}</span>
                      </div>
                      {admin.phone && (
                        <div className="flex items-center space-x-2">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">{admin.phone}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        admin.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {admin.isActive ? 'Active' : 'Inactive'}
                      </span>
                                             <span className="text-xs text-gray-500">
                         Created: {admin.createdAt?._seconds 
                           ? new Date(admin.createdAt._seconds * 1000).toLocaleDateString()
                           : new Date(admin.createdAt).toLocaleDateString()}
                       </span>
                    </div>
                  </div>

                  <div className="ml-6 flex flex-col space-y-2">
                    <button
                      onClick={() => setSelectedRangeAdmin(admin)}
                      className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
              </div>
            </>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center">
                    <Building2 className="w-8 h-8 text-blue-500" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Ranges</p>
                      <p className="text-2xl font-bold text-gray-900">{ranges.length}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center">
                    <MapPin className="w-8 h-8 text-green-500" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Active Ranges</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {ranges.filter(r => r.isActive !== false).length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ranges List */}
              <div className="bg-white rounded-lg border">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Shooting Ranges</h2>
                </div>
                
                {ranges.length === 0 ? (
                  <div className="p-8 text-center">
                    <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No ranges added yet</p>
                    <button
                      onClick={() => setShowCreateRangeForm(true)}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Add First Range
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {ranges.map((range) => (
                      <div key={range.id} className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-4 mb-4">
                              <div className="flex items-center space-x-2">
                                <Building2 className="w-5 h-5 text-blue-500" />
                                <span className="text-lg font-semibold text-gray-900">
                                  {range.name}
                                </span>
                              </div>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                range.isActive !== false
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {range.isActive !== false ? 'Active' : 'Inactive'}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              <div className="flex items-center space-x-2">
                                <MapPin className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-600">
                                  {range.address}, {range.city}, {range.state} {range.zipCode}
                                </span>
                              </div>
                              {range.phone && (
                                <div className="flex items-center space-x-2">
                                  <Phone className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm text-gray-600">{range.phone}</span>
                                </div>
                              )}
                              {range.email && (
                                <div className="flex items-center space-x-2">
                                  <Mail className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm text-gray-600">{range.email}</span>
                                </div>
                              )}
                              {range.website && (
                                <div className="flex items-center space-x-2">
                                  <span className="text-sm text-blue-600">
                                    <a href={range.website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                      {range.website}
                                    </a>
                                  </span>
                                </div>
                              )}
                            </div>

                            {range.description && (
                              <p className="text-sm text-gray-600 mb-2">{range.description}</p>
                            )}
                            {range.facilities && (
                              <p className="text-xs text-gray-500">Facilities: {range.facilities}</p>
                            )}
                          </div>

                          <div className="ml-6 flex flex-col space-y-2">
                            <button
                              onClick={() => {
                                setSelectedRange(range);
                                setRangeFormData({
                                  name: range.name || '',
                                  address: range.address || '',
                                  city: range.city || '',
                                  state: range.state || '',
                                  zipCode: range.zipCode || '',
                                  phone: range.phone || '',
                                  email: range.email || '',
                                  website: range.website || '',
                                  description: range.description || '',
                                  facilities: range.facilities || '',
                                  contactName: range.contactName || '',
                                  contactEmail: range.contactEmail || '',
                                  contactPhone: range.contactPhone || ''
                                });
                                setShowCreateRangeForm(true);
                              }}
                              className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteRange(range.id)}
                              className="px-3 py-1 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create Range Admin Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Create Range Admin Account</h2>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name *
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Username *
                    </label>
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      required
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password *
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    minLength={6}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Range Name *
                  </label>
                  <input
                    type="text"
                    name="rangeName"
                    value={formData.rangeName}
                    onChange={handleInputChange}
                    required
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Range Location *
                  </label>
                  <input
                    type="text"
                    name="rangeLocation"
                    value={formData.rangeLocation}
                    onChange={handleInputChange}
                    required
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createRangeAdminMutation.isLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {createRangeAdminMutation.isLoading ? 'Creating...' : 'Create Range Admin'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Range Admin Details Modal */}
      {selectedRangeAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Range Admin Details</h2>
                <button
                  onClick={() => setSelectedRangeAdmin(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Name</p>
                    <p className="font-medium">
                      {selectedRangeAdmin.firstName} {selectedRangeAdmin.lastName}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Username</p>
                    <p className="font-medium">@{selectedRangeAdmin.username}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">{selectedRangeAdmin.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="font-medium">{selectedRangeAdmin.phone || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Range Name</p>
                    <p className="font-medium">{selectedRangeAdmin.rangeName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Range Location</p>
                    <p className="font-medium">{selectedRangeAdmin.rangeLocation}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      selectedRangeAdmin.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {selectedRangeAdmin.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Created</p>
                                         <p className="font-medium">
                       {selectedRangeAdmin.createdAt?._seconds 
                         ? new Date(selectedRangeAdmin.createdAt._seconds * 1000).toLocaleDateString()
                         : new Date(selectedRangeAdmin.createdAt).toLocaleDateString()}
                     </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setSelectedRangeAdmin(null)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Range Modal */}
      {showCreateRangeForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {selectedRange ? 'Edit Range' : 'Add New Range'}
                </h2>
                <button
                  onClick={() => {
                    setShowCreateRangeForm(false);
                    setSelectedRange(null);
                    setRangeFormData({
                      name: '',
                      address: '',
                      city: '',
                      state: '',
                      zipCode: '',
                      phone: '',
                      email: '',
                      website: '',
                      description: '',
                      facilities: '',
                      contactName: '',
                      contactEmail: '',
                      contactPhone: ''
                    });
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={selectedRange ? handleUpdateRange : handleCreateRange} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Range Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={rangeFormData.name}
                      onChange={handleRangeInputChange}
                      required
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Street Address *
                    </label>
                    <input
                      type="text"
                      name="address"
                      value={rangeFormData.address}
                      onChange={handleRangeInputChange}
                      required
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City *
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={rangeFormData.city}
                      onChange={handleRangeInputChange}
                      required
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State *
                    </label>
                    <input
                      type="text"
                      name="state"
                      value={rangeFormData.state}
                      onChange={handleRangeInputChange}
                      required
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ZIP Code *
                    </label>
                    <input
                      type="text"
                      name="zipCode"
                      value={rangeFormData.zipCode}
                      onChange={handleRangeInputChange}
                      required
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={rangeFormData.phone}
                      onChange={handleRangeInputChange}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={rangeFormData.email}
                      onChange={handleRangeInputChange}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Website
                    </label>
                    <input
                      type="url"
                      name="website"
                      value={rangeFormData.website}
                      onChange={handleRangeInputChange}
                      placeholder="https://..."
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={rangeFormData.description}
                      onChange={handleRangeInputChange}
                      rows={3}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Brief description of the range..."
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Facilities
                    </label>
                    <input
                      type="text"
                      name="facilities"
                      value={rangeFormData.facilities}
                      onChange={handleRangeInputChange}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Indoor/Outdoor, 25yd/50yd lanes, etc."
                    />
                  </div>

                  <div className="md:col-span-2 border-t pt-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contact Name
                    </label>
                    <input
                      type="text"
                      name="contactName"
                      value={rangeFormData.contactName}
                      onChange={handleRangeInputChange}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contact Email
                    </label>
                    <input
                      type="email"
                      name="contactEmail"
                      value={rangeFormData.contactEmail}
                      onChange={handleRangeInputChange}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      name="contactPhone"
                      value={rangeFormData.contactPhone}
                      onChange={handleRangeInputChange}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateRangeForm(false);
                      setSelectedRange(null);
                      setRangeFormData({
                        name: '',
                        address: '',
                        city: '',
                        state: '',
                        zipCode: '',
                        phone: '',
                        email: '',
                        website: '',
                        description: '',
                        facilities: '',
                        contactName: '',
                        contactEmail: '',
                        contactPhone: ''
                      });
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createRangeMutation.isLoading || updateRangeMutation.isLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {createRangeMutation.isLoading || updateRangeMutation.isLoading
                      ? 'Saving...'
                      : selectedRange
                      ? 'Update Range'
                      : 'Create Range'}
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

export default RangeAdminManagement;
