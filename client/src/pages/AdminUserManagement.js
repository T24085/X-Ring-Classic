import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { adminAPI, usersAPI, rangesAPI } from '../services/api.firebase';
import { Search, Trash2, Shield, UserCheck, UserX, ChevronLeft, ChevronRight, Eye, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';

const RoleBadge = ({ role }) => {
  const cls = role === 'admin' ? 'bg-purple-100 text-purple-800' : role === 'range_admin' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
  return <span className={`px-2 py-1 text-xs rounded-full ${cls}`}>{role?.replace('_',' ')}</span>;
};

const AdminUserManagement = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState('');
  const [selectingRangeFor, setSelectingRangeFor] = useState(null);
  const [selectedRangeId, setSelectedRangeId] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery(['admin-users', page, roleFilter, search], () => adminAPI.getUsers({ page, limit: 20, role: roleFilter || undefined, search: search || undefined }));
  
  const { data: rangesData } = useQuery('ranges', () => rangesAPI.getAll(), {
    staleTime: 5 * 60 * 1000,
  });
  const ranges = rangesData?.data?.ranges || [];

  const verifyMutation = useMutation((userId) => usersAPI.verify(userId), {
    onSuccess: () => { toast.success('User verified'); queryClient.invalidateQueries('admin-users'); },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to verify')
  });
  const deactivateMutation = useMutation((userId) => usersAPI.deactivate(userId), {
    onSuccess: () => { toast.success('User deactivated'); queryClient.invalidateQueries('admin-users'); },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to deactivate')
  });
  const updateRoleMutation = useMutation(({ userId, role, rangeId }) => usersAPI.updateRole(userId, role, rangeId), {
    onSuccess: () => { toast.success('Role updated'); queryClient.invalidateQueries('admin-users'); setSelectingRangeFor(null); setSelectedRangeId(''); },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to update role')
  });
  const updateRangeMutation = useMutation(({ userId, rangeId }) => usersAPI.updateUserRange(userId, rangeId), {
    onSuccess: () => { toast.success('Range assignment updated'); queryClient.invalidateQueries('admin-users'); setSelectingRangeFor(null); setSelectedRangeId(''); },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to update range assignment')
  });
  const deleteMutation = useMutation((userId) => usersAPI.delete(userId), {
    onSuccess: () => { toast.success('User removed'); queryClient.invalidateQueries('admin-users'); },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to remove user')
  });

  const handleRoleChange = (userId, newRole) => {
    if (newRole === 'range_admin') {
      // Show range selection
      setSelectingRangeFor(userId);
      setSelectedRangeId('');
    } else {
      // Update role without range
      updateRoleMutation.mutate({ userId, role: newRole });
    }
  };

  const handleRangeSelection = () => {
    if (!selectingRangeFor) return;
    if (!selectedRangeId) {
      toast.error('Please select a range');
      return;
    }
    const user = users.find(u => u.id === selectingRangeFor);
    if (user?.role === 'range_admin') {
      // Just updating range assignment
      updateRangeMutation.mutate({ userId: selectingRangeFor, rangeId: selectedRangeId });
    } else {
      // Changing role to range_admin and assigning range
      updateRoleMutation.mutate({ userId: selectingRangeFor, role: 'range_admin', rangeId: selectedRangeId });
    }
  };

  const users = data?.users || [];
  const pagination = data?.pagination;

  const handleDelete = (u) => {
    if (!window.confirm(`Remove ${u.username || u.email}? This deletes their scores and registrations.`)) return;
    deleteMutation.mutate(u.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white drop-shadow-lg">Manage Users</h1>
          <p className="text-white drop-shadow-md">Search, verify, change roles, deactivate, or remove users.</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-600 absolute left-3 top-3" />
          <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search name, username, email..." className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={roleFilter} onChange={(e)=>{setRoleFilter(e.target.value); setPage(1);}} className="px-3 py-2 border rounded-lg">
          <option value="">All Roles</option>
          <option value="competitor">Competitor</option>
          <option value="range_admin">Range Admin</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Users</h2>
        </div>
        {isLoading ? (
          <div className="p-6 text-center">Loading...</div>
        ) : error ? (
          <div className="p-6 text-center text-red-600">Failed to load users</div>
        ) : users.length === 0 ? (
          <div className="p-6 text-center text-gray-700">No users found</div>
        ) : (
          <div className="divide-y">
            {users.map(u => (
              <div key={u.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-semibold text-gray-700">
                    {(u.firstName?.[0] || u.username?.[0] || 'U').toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{u.firstName} {u.lastName} <span className="text-gray-700">@{u.username}</span></div>
                    <div className="text-sm text-gray-700">{u.email}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <RoleBadge role={u.role} />
                      {u.role === 'range_admin' && u.rangeName && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700 flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {u.rangeName}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 text-xs rounded-full ${u.isVerified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{u.isVerified ? 'Verified' : 'Pending'}</span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${u.isActive === false ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{u.isActive === false ? 'Inactive' : 'Active'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => navigate(`/profile/${u.id}`)} 
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
                  >
                    <Eye className="w-4 h-4" /> View Profile
                  </button>
                  {!u.isVerified && (
                    <button onClick={()=>verifyMutation.mutate(u.id)} className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"><UserCheck className="w-4 h-4" /> Verify</button>
                  )}
                  {u.isActive !== false ? (
                    <button onClick={()=>deactivateMutation.mutate(u.id)} className="px-3 py-1 text-sm bg-gray-100 text-gray-800 rounded hover:bg-gray-200 flex items-center gap-1"><UserX className="w-4 h-4" /> Deactivate</button>
                  ) : null}
                  <div className="relative">
                    <select value={u.role} onChange={(e)=>handleRoleChange(u.id, e.target.value)} className="px-2 py-1 text-sm border rounded">
                      <option value="competitor">Competitor</option>
                      <option value="range_admin">Range Admin</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  {u.role === 'range_admin' && (
                    <button 
                      onClick={() => { setSelectingRangeFor(u.id); setSelectedRangeId(u.rangeId || ''); }}
                      className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-1"
                      title="Change Range Assignment"
                    >
                      <Building2 className="w-4 h-4" /> {u.rangeName ? 'Change Range' : 'Assign Range'}
                    </button>
                  )}
                  <button onClick={()=>handleDelete(u)} className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-1"><Trash2 className="w-4 h-4" /> Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="px-6 py-3 border-t flex items-center justify-between text-sm text-gray-700">
          <div>
            {pagination ? (
              <span>Page {pagination.current} of {pagination.total} • {pagination.totalUsers} users</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button disabled={!pagination?.hasPrev} onClick={()=> setPage(p => Math.max(1, p-1))} className="px-2 py-1 border rounded disabled:opacity-50 flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Prev</button>
            <button disabled={!pagination?.hasNext} onClick={()=> setPage(p => p+1)} className="px-2 py-1 border rounded disabled:opacity-50 flex items-center gap-1">Next <ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* Range Selection Modal */}
      {selectingRangeFor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Select Range</h3>
            <p className="text-sm text-gray-600 mb-4">
              {users.find(u => u.id === selectingRangeFor)?.role === 'range_admin' 
                ? 'Change range assignment for this range admin:' 
                : 'Assign a range to this user (they will be set as range admin):'}
            </p>
            <select 
              value={selectedRangeId} 
              onChange={(e) => setSelectedRangeId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg mb-4"
            >
              <option value="">Select a range...</option>
              {ranges.map(range => (
                <option key={range.id} value={range.id}>{range.name}</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setSelectingRangeFor(null); setSelectedRangeId(''); }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRangeSelection}
                disabled={!selectedRangeId || updateRoleMutation.isLoading || updateRangeMutation.isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {updateRoleMutation.isLoading || updateRangeMutation.isLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserManagement;

