import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axiosInstance'; //[cite: 1]
import { useAuth } from '../../context/AuthContext'; //[cite: 1]

interface Account {
  id: number;
  name: string;
  code: string;
  account_type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'; //[cite: 1]
  description: string;
  is_active: boolean;
}

const ChartOfAccounts: React.FC = () => {
  const navigate = useNavigate();
  const { user, isLoading: isAuthLoading } = useAuth(); //[cite: 1]

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState(''); //[cite: 1]
  const [typeFilter, setTypeFilter] = useState('All'); //[cite: 1]
  const [statusFilter, setStatusFilter] = useState('All'); //[cite: 1]

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    account_type: 'Asset',
    description: '',
    is_active: true
  });

  useEffect(() => {
    fetchAccounts(); //[cite: 1]
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await api.get('/accounting/accounts/'); //[cite: 1]
      setAccounts(res.data);
    } catch (err) {
      console.error("Failed to load accounts", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/accounting/accounts/', formData);
      setIsModalOpen(false);
      setFormData({ name: '', code: '', account_type: 'Asset', description: '', is_active: true });
      fetchAccounts(); 
    } catch (err) {
      console.error("Failed to create account", err);
      // Optional: Add toast/error notification here
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredAccounts = useMemo(() => {
    return accounts.filter(acc => {
      const matchesSearch = acc.name.toLowerCase().includes(searchQuery.toLowerCase()) || acc.code.includes(searchQuery); //[cite: 1]
      const matchesType = typeFilter === 'All' || acc.account_type === typeFilter; //[cite: 1]
      const matchesStatus = statusFilter === 'All' || (statusFilter === 'Active' ? acc.is_active : !acc.is_active); //[cite: 1]
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [accounts, searchQuery, typeFilter, statusFilter]);

  const groupedAccounts = useMemo(() => {
    const groups: Record<string, Account[]> = { Asset: [], Liability: [], Equity: [], Revenue: [], Expense: [] }; //[cite: 1]
    filteredAccounts.forEach(acc => groups[acc.account_type].push(acc)); //[cite: 1]
    return groups;
  }, [filteredAccounts]);

  if (isAuthLoading) return <div className="p-10 text-center text-gray-500">Verifying session...</div>; //[cite: 1]
  if (isLoading) return <div className="p-10 text-center text-gray-500">Loading Chart of Accounts...</div>; //[cite: 1]

  const adminRoles = ['Admin', 'Super_Admin', 'Tenant_Admin']; //[cite: 1]
  const routePrefix = user?.role && adminRoles.includes(user.role) ? '/admin' : '/manager'; //[cite: 1]

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-gray-800">Chart of Accounts</h2>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
        >
          + New Account
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap gap-4 items-center">
        <input 
          type="text" 
          placeholder="Search accounts..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-[200px] border border-gray-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500"
        />
        <select 
          value={typeFilter} 
          onChange={(e) => setTypeFilter(e.target.value)}
          className="border border-gray-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500 bg-white"
        >
          <option value="All">Type ▾</option>
          <option value="Asset">Asset</option>
          <option value="Liability">Liability</option>
          <option value="Equity">Equity</option>
          <option value="Revenue">Revenue</option>
          <option value="Expense">Expense</option>
        </select>
        <select 
          value={statusFilter} 
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500 bg-white"
        >
          <option value="All">Status ▾</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {/* Account Groups */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-8">
        {(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] as const).map(type => {
          const accs = groupedAccounts[type]; //[cite: 1]
          if (accs.length === 0) return null; //[cite: 1]

          return (
            <div key={type}>
              <h3 className="text-lg font-black text-gray-800 mb-2">{type}s</h3>
              <div className="border-b-2 border-gray-800 mb-3"></div>
              <ul className="space-y-1">
                {accs.map(acc => (
                  <li 
                    key={acc.id} 
                    onClick={() => navigate(`${routePrefix}/accounting/accounts/${acc.id}`)}
                    className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer transition-colors group"
                  >
                    <span className="w-20 font-mono font-bold text-gray-500 group-hover:text-blue-600 transition-colors">{acc.code}</span>
                    <span className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{acc.name}</span>
                    {!acc.is_active && <span className="ml-3 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded font-bold">Inactive</span>}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Create Account Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Create New Account</h3>
            <form onSubmit={handleCreateAccount} className="space-y-4">
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Account Name *</label>
                <input 
                  type="text" 
                  maxLength={255}
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500" 
                  placeholder="e.g. Cash in Bank"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Code *</label>
                  <input 
                    type="text" 
                    maxLength={50}
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500" 
                    placeholder="e.g. 1010"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Type *</label>
                  <select 
                    value={formData.account_type}
                    onChange={(e) => setFormData({...formData, account_type: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="Asset">Asset</option>
                    <option value="Liability">Liability</option>
                    <option value="Equity">Equity</option>
                    <option value="Revenue">Revenue</option>
                    <option value="Expense">Expense</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Description</label>
                <textarea 
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500"
                  placeholder="Optional details..."
                  rows={3}
                />
              </div>

              <div className="flex items-center">
                <input 
                  type="checkbox" 
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                  className="mr-2 h-4 w-4 text-blue-600 rounded border-gray-300"
                />
                <label htmlFor="is_active" className="text-sm font-bold text-gray-700">Account is Active</label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:bg-blue-400"
                >
                  {isSubmitting ? 'Saving...' : 'Save Account'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ChartOfAccounts;