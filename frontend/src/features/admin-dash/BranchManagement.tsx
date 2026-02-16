import React, { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import api from '../../api/axiosInstance';
import { isAxiosError } from 'axios';

// --- Types ---
interface Branch {
  id: number;
  name: string;
  code: string;
  location: string;
}

interface NewBranchPayload {
  name: string;
  code: string;
  location: string;
}

const BranchManagement: React.FC = () => {
  // --- State ---
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState<NewBranchPayload>({
    name: '',
    code: '',
    location: ''
  });

  // --- Fetch Existing Branches on Load ---
  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      const response = await api.get('/branches');
      setBranches(response.data);
    } catch (err) {
      console.error("Failed to load branches", err);
      // Don't block the UI, just show empty list or subtle error
    } finally {
      setIsLoading(false);
    }
  };

  // --- Handlers ---
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      // 1. Create the Branch
      const response = await api.post('/branches/', formData);
      
      // 2. Add to list immediately (Optimistic UI)
      setBranches([...branches, response.data]);
      
      setSuccessMsg(`Branch "${formData.name}" created successfully!`);
      setFormData({ name: '', code: '', location: '' }); // Reset form

    } catch (err) {
      if (isAxiosError(err)) {
        setError(err.response?.data?.message || 'Failed to create branch.');
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Branch Management</h1>
        <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
          Total Branches: {branches.length}
        </span>
      </div>

      {/* --- CREATE BRANCH FORM --- */}
      <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Add New Location</h2>
        
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">{error}</div>}
        {successMsg && <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded border border-green-200">{successMsg}</div>}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700">Branch Name</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} required placeholder="e.g. Westside Coldroom"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Branch Code</label>
            <input type="text" name="code" value={formData.code} onChange={handleChange} required placeholder="e.g. LAG-02"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Location</label>
            <input type="text" name="location" value={formData.location} onChange={handleChange} required placeholder="e.g. 123 Industrial Ave"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500" />
          </div>

          <div className="md:col-span-3 flex justify-end">
            <button type="submit" disabled={isSubmitting}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium">
              {isSubmitting ? 'Creating...' : '+ Create Branch'}
            </button>
          </div>
        </form>
      </div>

      {/* --- BRANCH LIST TABLE --- */}
      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
               <tr><td colSpan={4} className="px-6 py-4 text-center">Loading branches...</td></tr>
            ) : branches.length === 0 ? (
               <tr><td colSpan={4} className="px-6 py-4 text-center text-gray-500">No branches found.</td></tr>
            ) : (
              branches.map((branch) => (
                <tr key={branch.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">{branch.code}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{branch.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{branch.location}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">Active</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BranchManagement;