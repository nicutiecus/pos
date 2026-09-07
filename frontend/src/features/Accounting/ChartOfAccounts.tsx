import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axiosInstance';
// Import your authentication context/hook here
import { useAuth } from '../../context/AuthContext';

interface Account {
  id: number;
  name: string;
  code: string;
  account_type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
  description: string;
  is_active: boolean;
}

const ChartOfAccounts: React.FC = () => {
  const navigate = useNavigate();
  
  const {user, isLoading: isAuthLoading} = useAuth(); 

  

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

 

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await api.get('/accounting/accounts/');
      setAccounts(res.data);
    } catch (err) {
      console.error("Failed to load accounts", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter and Group Accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter(acc => {
      const matchesSearch = acc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            acc.code.includes(searchQuery);
      const matchesType = typeFilter === 'All' || acc.account_type === typeFilter;
      const matchesStatus = statusFilter === 'All' || 
                            (statusFilter === 'Active' ? acc.is_active : !acc.is_active);
      
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [accounts, searchQuery, typeFilter, statusFilter]);

  const groupedAccounts = useMemo(() => {
    const groups: Record<string, Account[]> = {
      Asset: [], Liability: [], Equity: [], Revenue: [], Expense: []
    };
    filteredAccounts.forEach(acc => groups[acc.account_type].push(acc));
    return groups;
  }, [filteredAccounts]);

   if (isAuthLoading) {
    return <div className="p-10 text-center text-gray-500">Verifying session...</div>;
  }
  
  if (isLoading) return <div className="p-10 text-center text-gray-500">Loading Chart of Accounts...</div>;

  // Determine the correct routing prefix based on the user's role
  const adminRoles = ['Admin', 'Super_Admin', 'Tenant_Admin'];
  const routePrefix = user?.role && adminRoles.includes(user.role) ? '/admin' : '/manager';


  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-gray-800">Chart of Accounts</h2>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors">
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
          const accs = groupedAccounts[type];
          if (accs.length === 0) return null;

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

    </div>
  );
};

export default ChartOfAccounts;