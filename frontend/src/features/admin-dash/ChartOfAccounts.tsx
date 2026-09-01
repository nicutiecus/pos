import React, { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import api from '../../api/axiosInstance';
import { isAxiosError } from 'axios';

interface Account {
  id: number;
  name: string;
  code: string;
  account_type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
  description: string;
  is_active: boolean;
}

interface AccountFormData {
  name: string;
  code: string;
  account_type: string;
  description: string;
}

const ChartOfAccounts: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const initialFormState: AccountFormData = {
    name: '',
    code: '',
    account_type: 'Asset',
    description: ''
  };
  const [formData, setFormData] = useState<AccountFormData>(initialFormState);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await api.get('/accounting/accounts/');
      setAccounts(res.data);
    } catch (err) {
      console.error("Failed to load accounts", err);
      setFeedback({ type: 'error', message: 'Failed to load Chart of Accounts.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCreateAccount = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = await api.post('/accounting/accounts/', formData);
      setAccounts([...accounts, res.data.account].sort((a, b) => a.code.localeCompare(b.code)));
      setFeedback({ type: 'success', message: 'Account created successfully!' });
      setFormData(initialFormState);
      setShowForm(false);
    } catch (err) {
      if (isAxiosError(err)) {
        setFeedback({ type: 'error', message: err.response?.data?.error || 'Failed to create account.' });
      }
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const toggleAccountStatus = async (id: number, currentStatus: boolean) => {
    try {
      const res = await api.patch(`/accounting/accounts/${id}/`, { is_active: !currentStatus });
      setAccounts(accounts.map(acc => acc.id === id ? res.data.account : acc));
    } catch (err) {
      if (isAxiosError(err)) {
        alert(err.response?.data?.error || 'Failed to update account status.');
      }
    }
  };

  if (isLoading) {
    return <div className="p-10 text-center text-gray-500">Loading Chart of Accounts...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Header & Actions */}
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div>
          <h2 className="text-2xl font-black text-gray-800">Chart of Accounts</h2>
          <p className="text-sm text-gray-500">Manage your General Ledger accounts for automated journal entries.</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className={`px-4 py-2 rounded-lg font-medium text-white transition-colors ${
            showForm ? 'bg-gray-500 hover:bg-gray-600' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {showForm ? 'Cancel' : '+ New Account'}
        </button>
      </div>

      {feedback && (
        <div className={`p-4 rounded-lg shadow-sm border-l-4 font-medium animate-fade-in-down ${
          feedback.type === 'success' ? 'bg-green-50 border-green-500 text-green-800' : 'bg-red-50 border-red-500 text-red-800'
        }`}>
          {feedback.message}
        </div>
      )}

      {/* Creation Form */}
      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 shadow-sm animate-fade-in-down">
          <form onSubmit={handleCreateAccount} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Account Code</label>
              <input type="text" name="code" value={formData.code} onChange={handleChange} required placeholder="e.g. 1000"
                className="w-full rounded-md border-gray-300 shadow-sm p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">Account Name</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} required placeholder="e.g. Inventory Asset"
                className="w-full rounded-md border-gray-300 shadow-sm p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Type</label>
              <select name="account_type" value={formData.account_type} onChange={handleChange}
                className="w-full rounded-md border-gray-300 shadow-sm p-2 text-sm bg-white focus:ring-blue-500 outline-none">
                <option value="Asset">Asset</option>
                <option value="Liability">Liability</option>
                <option value="Equity">Equity</option>
                <option value="Revenue">Revenue</option>
                <option value="Expense">Expense</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-bold text-gray-700 mb-1">Description (Optional)</label>
              <input type="text" name="description" value={formData.description} onChange={handleChange} placeholder="Brief description of this account's purpose..."
                className="w-full rounded-md border-gray-300 shadow-sm p-2 text-sm focus:ring-blue-500 outline-none" />
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={isSubmitting} 
                className="w-full bg-blue-700 text-white px-4 py-2 rounded text-sm font-bold hover:bg-blue-800 disabled:opacity-50">
                {isSubmitting ? 'Saving...' : 'Save Account'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Accounts Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Code</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Account Info</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {accounts.length === 0 ? (
               <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-medium">No accounts defined. Create your initial ledger structure above.</td></tr>
            ) : (
              accounts.map((acc) => (
                <tr key={acc.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-600 font-bold">{acc.code}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-gray-900">{acc.name}</div>
                    {acc.description && <div className="text-xs text-gray-500 truncate max-w-xs">{acc.description}</div>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">{acc.account_type}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      acc.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {acc.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button 
                      onClick={() => toggleAccountStatus(acc.id, acc.is_active)}
                      className={`text-xs font-bold px-3 py-1.5 rounded transition-colors ${
                        acc.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'
                      }`}
                    >
                      {acc.is_active ? 'Deactivate' : 'Activate'}
                    </button>
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

export default ChartOfAccounts;