import React, { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import api from '../../api/axiosInstance';
import { isAxiosError } from 'axios';

// --- Types ---
interface Branch {
  id: number;
  name: string;
}

interface User {
  id: number;
  email: string;
  first_name: string; // Updated from 'name'
  last_name: string;  // Added
  role: 'Branch_Manager' | 'Cashier' | 'Tenant_Admin';
  branch_name?: string;
}

interface NewUserPayload {
  first_name: string; // Updated
  last_name: string;  // Updated
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

  // Form State
  const [formData, setFormData] = useState<NewUserPayload>({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    role: 'Cashier',
    branchId: ''
  });

  // --- Initial Data Fetch ---
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [usersRes, branchesRes] = await Promise.all([
        api.get('/staff'),
        api.get('/branches')
      ]);
      setUsers(usersRes.data);
      setBranches(branchesRes.data);
    } catch (err) {
      console.error("Failed to load data", err);
      setError("Could not load users or branches. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Handlers ---
  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    if (!formData.branchId) {
      setError("Please assign this user to a branch.");
      setIsSubmitting(false);
      return;
    }

    try {
      // Updated Payload to match Django Serializer
      const response = await api.post('/staff/', {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        branch_id: formData.branchId 
      });

      // Optimistic Update
      setUsers([...users, response.data]);
      
      setSuccessMsg(`User ${formData.first_name} created successfully!`);
      // Reset form
      setFormData({ 
        first_name: '', 
        last_name: '', 
        email: '', 
        password: '', 
        role: 'Cashier', 
        branchId: '' 
      }); 

    } catch (err) {
      if (isAxiosError(err)) {
        setError(err.response?.data?.message || 'Failed to create user.');
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading Staff Data...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Users & Roles</h1>
        <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
          Total Staff: {users.length}
        </span>
      </div>

      {/* --- Section 1: Create New User Form --- */}
      <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Provision New Staff</h2>
        
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">{error}</div>}
        {successMsg && <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded border border-green-200">{successMsg}</div>}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          
          {/* First Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700">First Name</label>
            <input type="text" name="first_name" value={formData.first_name} onChange={handleInputChange} required placeholder="e.g. John"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500" />
          </div>

          {/* Last Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Last Name</label>
            <input type="text" name="last_name" value={formData.last_name} onChange={handleInputChange} required placeholder="e.g. Doe"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500" />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Email Address</label>
            <input type="email" name="email" value={formData.email} onChange={handleInputChange} required placeholder="john@company.com"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500" />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Temporary Password</label>
            <input type="password" name="password" value={formData.password} onChange={handleInputChange} required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500" />
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Role</label>
            <select name="role" value={formData.role} onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500 bg-white">
              <option value="Cashier">Cashier (Point of Sale)</option>
              <option value="Branch_Manager">Branch Manager</option>
            </select>
          </div>

          {/* Branch Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Assign to Branch</label>
            <select name="branchId" value={formData.branchId} onChange={handleInputChange} required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500 bg-white">
              <option value="">-- Select Branch --</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </div>

          {/* Submit Button - Spans full width on mobile, right aligned on desktop */}
          <div className="md:col-span-2 lg:col-span-3 flex justify-end">
            <button type="submit" disabled={isSubmitting}
              className="w-full md:w-auto bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium">
              {isSubmitting ? 'Creating...' : '+ Create User'}
            </button>
          </div>
        </form>
      </div>

      {/* --- Section 2: Users List Table --- */}
      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Branch</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.length === 0 ? (
               <tr>
                 <td colSpan={4} className="px-6 py-4 text-center text-gray-500">No users found. Create one above!</td>
               </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold">
                        {/* Display initials based on new fields */}
                        {user.first_name?.[0]}{user.last_name?.[0]}
                      </div>
                      <div className="ml-4">
                        {/* Concatenate First and Last Name for Display */}
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
                    <span className="text-green-600">Active</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default UserManagement;