import React, { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import api from '../../api/axiosInstance';
import { isAxiosError } from 'axios';
import ChangePasswordModal from './ChangePasswordModal';
import UserSettingsModal from './UserSettingsModal'; // --- NEW IMPORT ---

// --- Types ---
interface Branch {
  id: number;
  name: string;
}

interface User {
  id: number;
  email: string;
  first_name: string; 
  last_name: string;  
  role: 'Branch_Manager' | 'Cashier' | 'Tenant_Admin';
  branch_name?: string;
  branch_id?: string | number; // Added to pass to modal
  is_active?: boolean; 
  custom_permissions?: string[];
}

interface NewUserPayload {
  first_name: string; 
  last_name: string;  
  email: string;
  password: string;
  role: 'Branch_Manager' | 'Cashier';
  branchId: string;
}

const UserManagement: React.FC = () => {
  // --- State ---
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal State
  const [passwordModalUser, setPasswordModalUser] = useState<{ id: number; name: string } | null>(null);
  const [editModalUser, setEditModalUser] = useState<User | null>(null); // --- NEW MODAL STATE ---

  // Form State
  const [formData, setFormData] = useState<NewUserPayload>({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    role: 'Cashier',
    branchId: ''
  });

  // --- Initial Fetch ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, branchesRes] = await Promise.all([
          api.get('/staff'),
          api.get('/branches') 
        ]);
        setUsers(usersRes.data);
        setBranches(branchesRes.data);
      } catch (err) {
        console.error("Failed to load staff data", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        branch_id: formData.branchId || null
      };

      const res = await api.post('/staff/', payload);
      setUsers([res.data, ...users]); 
      setSuccessMsg("User created successfully!");
      setFormData({
        first_name: '', last_name: '', email: '', password: '', role: 'Cashier', branchId: ''
      });
      
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      if (isAxiosError(err)) {
        setError(err.response?.data?.message || 'Failed to create user. Please check email uniqueness.');
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (userId: number, currentStatus: boolean) => {
    const actionText = currentStatus ? "deactivate" : "activate";
    if (!window.confirm(`Are you sure you want to ${actionText} this account?`)) return;

    try {
      await api.patch(`/staff/${userId}/`, {
        is_active: !currentStatus
      });
      
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === userId ? { ...user, is_active: !currentStatus } : user
        )
      );
    } catch (err: any) {
      alert(`Failed to ${actionText} user: ${err.response?.data?.message || err.message}`);
    }
  };

  // --- NEW: Handle save from settings modal ---
  const handleSaveUserSettings = (updatedData: any) => {
    setUsers(prevUsers => 
      prevUsers.map(user => user.id === updatedData.id ? {...user, ...updatedData}:user)
    );
    setEditModalUser(null);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Add New Staff Member</h2>
        
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded">{error}</div>}
        {successMsg && <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded">{successMsg}</div>}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
             <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} required
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
             <input type="text" name="last_name" value={formData.last_name} onChange={handleChange} required
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
             <input type="email" name="email" value={formData.email} onChange={handleChange} required
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password</label>
             <input type="text" name="password" value={formData.password} onChange={handleChange} required minLength={6}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">System Role</label>
             <select name="role" value={formData.role} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded bg-white">
                <option value="Cashier">Cashier</option>
                <option value="Branch_Manager">Branch Manager</option>
             </select>
          </div>
          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Assign Branch</label>
             <select name="branchId" value={formData.branchId} onChange={handleChange} required
                className="w-full p-2 border border-gray-300 rounded bg-white">
                <option value="" disabled>-- Select a Branch --</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
             </select>
          </div>
          <div className="md:col-span-2 pt-2">
             <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 disabled:opacity-50">
                {isSubmitting ? 'Creating...' : 'Create Staff Account'}
             </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 p-4 border-b border-gray-200">
           <h3 className="font-bold text-gray-800">Current Staff Directory</h3>
        </div>
        
        {isLoading ? (
           <div className="p-10 text-center text-gray-500">Loading staff data...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-400">No users found.</td></tr>
            ) : (
              users.map(user => {
                const isActive = user.is_active !== false; 
                return (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600">
                         {user.first_name?.[0]}{user.last_name?.[0]}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{user.first_name} {user.last_name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${user.role === 'Tenant_Admin' ? 'bg-purple-100 text-purple-800' : 
                        user.role === 'Branch_Manager' ? 'bg-blue-100 text-blue-800' : 
                        'bg-green-100 text-green-800'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.branch_name || 'All Branches (HQ)'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {isActive ? (
                        <span className="text-green-600 font-bold">Active</span>
                    ) : (
                        <span className="text-red-500 font-bold">Inactive</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      
                      {/* --- NEW: Settings / Edit Button --- */}
                      <button 
                        onClick={() => setEditModalUser(user)}
                        className="text-gray-600 hover:text-gray-900 bg-gray-100 px-3 py-1.5 rounded-md transition-colors"
                        title="Edit Role & Permissions"
                      >
                        ⚙️ Edit
                      </button>

                      <button 
                        onClick={() => setPasswordModalUser({ id: user.id, name: `${user.first_name} ${user.last_name}` })}
                        className="text-blue-600 hover:text-blue-900 bg-blue-50 px-3 py-1.5 rounded-md transition-colors"
                        title="Reset Password"
                      >
                        🔑 Password
                      </button>
                      <button 
                        onClick={() => handleToggleStatus(user.id, isActive)}
                        className={`px-3 py-1.5 rounded-md transition-colors font-bold ${
                          isActive 
                            ? 'text-red-600 bg-red-50 hover:bg-red-100' 
                            : 'text-green-600 bg-green-50 hover:bg-green-100'
                        }`}
                      >
                        {isActive ? '🚫' : '✅'}
                      </button>
                    </div>
                  </td>
                </tr>
              )})
            )}
          </tbody>
        </table>
        )}
      </div>

      {/* --- MODALS --- */}
      {passwordModalUser && (
        <ChangePasswordModal 
          userId={passwordModalUser.id}
          userName={passwordModalUser.name}
          onClose={() => setPasswordModalUser(null)}
        />
      )}

      {editModalUser && (
        <UserSettingsModal 
          user={editModalUser}
          branches={branches}
          onClose={() => setEditModalUser(null)}
          onSave={handleSaveUserSettings}
        />
      )}
    </div>
  );
};

export default UserManagement;