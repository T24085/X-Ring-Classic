import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { adminAPI, usersAPI } from '../services/api';
import { Search, Trash2, Shield, UserCheck, UserX, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

const RoleBadge = ({ role }) => {
  const cls = role === 'admin' ? 'bg-purple-100 text-purple-800' : role === 'range_admin' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
  return <span className={`px-2 py-1 text-xs rounded-full ${cls}`}>{role?.replace('_',' ')}</span>;
};

const AdminUserManagement = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery(['admin-users', page, roleFilter, search], () => adminAPI.getUsers({ page, limit: 20, role: roleFilter || undefined, search: search || undefined }));

  const verifyMutation = useMutation((userId) => usersAPI.verify(userId), {
    onSuccess: () => { toast.success('User verified'); queryClient.invalidateQueries('admin-users'); },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to verify')
  });
  const deactivateMutation = useMutation((userId) => usersAPI.deactivate(userId), {
    onSuccess: () => { toast.success('User deactivated'); queryClient.invalidateQueries('admin-users'); },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to deactivate')
  });
  const updateRoleMutation = useMutation(({ userId, role }) => usersAPI.updateRole(userId, role), {
    onSuccess: () => { toast.success('Role updated'); queryClient.invalidateQueries('admin-users'); },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to update role')
  });
  const deleteMutation = useMutation((userId) => usersAPI.delete(userId), {
    onSuccess: () => { toast.success('User removed'); queryClient.invalidateQueries('admin-users'); },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to remove user')
  });

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
          <h1 className="text-3xl font-bold text-gray-900">Manage Users</h1>
          <p className="text-gray-600">Search, verify, change roles, deactivate, or remove users.</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
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
          <div className="p-6 text-center text-gray-600">No users found</div>
        ) : (
          <div className="divide-y">
            {users.map(u => (
              <div key={u.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-semibold text-gray-700">
                    {(u.firstName?.[0] || u.username?.[0] || 'U').toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{u.firstName} {u.lastName} <span className="text-gray-500">@{u.username}</span></div>
                    <div className="text-sm text-gray-600">{u.email}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <RoleBadge role={u.role} />
                      <span className={`px-2 py-0.5 text-xs rounded-full ${u.isVerified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{u.isVerified ? 'Verified' : 'Pending'}</span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${u.isActive === false ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{u.isActive === false ? 'Inactive' : 'Active'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!u.isVerified && (
                    <button onClick={()=>verifyMutation.mutate(u.id)} className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"><UserCheck className="w-4 h-4" /> Verify</button>
                  )}
                  {u.isActive !== false ? (
                    <button onClick={()=>deactivateMutation.mutate(u.id)} className="px-3 py-1 text-sm bg-gray-100 text-gray-800 rounded hover:bg-gray-200 flex items-center gap-1"><UserX className="w-4 h-4" /> Deactivate</button>
                  ) : null}
                  <div className="relative">
                    <select value={u.role} onChange={(e)=>updateRoleMutation.mutate({ userId: u.id, role: e.target.value })} className="px-2 py-1 text-sm border rounded">
                      <option value="competitor">Competitor</option>
                      <option value="range_admin">Range Admin</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <button onClick={()=>handleDelete(u)} className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-1"><Trash2 className="w-4 h-4" /> Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="px-6 py-3 border-t flex items-center justify-between text-sm text-gray-600">
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
    </div>
  );
};

export default AdminUserManagement;

