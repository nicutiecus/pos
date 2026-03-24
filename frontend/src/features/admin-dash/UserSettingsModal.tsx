import React, { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';
import { isAxiosError } from 'axios';

// Define the permissions your backend supports
const AVAILABLE_PERMISSIONS = [
  { id: 'view_dashboard', label: 'View Analytics Dashboard' },
  { id: 'manage_inventory', label: 'Add/Edit Inventory' },
  { id: 'delete_inventory', label: 'Delete Inventory Items' },
  { id: 'process_refunds', label: 'Process Sales Refunds' },
  { id: 'view_reports', label: 'View Financial Reports' },
  { id: 'manage_staff', label: 'Manage Branch Staff' },
   { id: 'view_expenses', label: 'Manage Expenses' },
   { id: 'create_products', label: 'Create Products' },
   { id: 'transfer_stock', label: 'Inventory Transfer' },
];

interface Branch {
  id: number | string;
  name: string;
}

interface UserSettingsModalProps {
  user: {
    id: number;
    first_name: string;
    last_name: string;
    role: string;
    branch_id?: string | number;
    custom_permissions?: string[];
  };
  branches: Branch[];
  onClose: () => void;
  onSave: (updatedUser: any) => void;
}

const UserSettingsModal: React.FC<UserSettingsModalProps> = ({ user, branches, onClose, onSave }) => {
  const [role, setRole] = useState(user.role);
  const [branchId, setBranchId] = useState(user.branch_id || '');
  const [permissions, setPermissions] = useState<string[]>(user.custom_permissions || []);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTogglePermission = (permId: string) => {
    setPermissions(prev => 
      prev.includes(permId) 
        ? prev.filter(p => p !== permId) 
        : [...prev, permId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        role,
        branch_id: branchId || null,
        custom_permissions: permissions // Send the updated array of permission strings to Django
      };

      const res = await api.patch(`/staff/${user.id}/`, payload);
      onSave(res.data); // Pass the updated user back to the parent table
    } catch (err) {
      setError(isAxiosError(err) ? err.response?.data?.message || 'Failed to update user settings.' : 'An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in-down">
        
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div>
              <h2 className="text-xl font-black text-gray-800 tracking-tight">User Settings</h2>
              <p className="text-xs text-gray-500 font-medium">Editing: {user.first_name} {user.last_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* System Role */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">System Role</label>
              <select 
                value={role} 
                onChange={(e) => setRole(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
              >
                <option value="Cashier">Cashier</option>
                <option value="Branch_Manager">Branch Manager</option>
                <option value="Tenant_Admin">Tenant Admin</option>
              </select>
            </div>

            {/* Branch Assignment */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Assigned Branch</label>
              <select 
                value={branchId} 
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
              >
                <option value="">-- All Branches (HQ) --</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Custom Permissions Grid */}
          <div>
            <div className="mb-3">
                <label className="block text-sm font-bold text-gray-700">Custom Permissions</label>
                <p className="text-xs text-gray-500">Grant specific capabilities to this user overriding their base role.</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 p-4 rounded-lg border border-gray-100">
              {AVAILABLE_PERMISSIONS.map((perm) => (
                <label key={perm.id} className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-white rounded transition-colors">
                  <input
                    type="checkbox"
                    checked={permissions.includes(perm.id)}
                    onChange={() => handleTogglePermission(perm.id)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">{perm.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-5 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white px-6 py-2 text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
              {isSubmitting ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserSettingsModal;