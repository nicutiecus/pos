import React, { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';

// --- Interfaces ---
interface AccountOption {
  id: string;
  name: string;
  code: string;
}

interface DefaultAccounts {
  inventory_account_id: string;
  accounts_receivable_id: string;
  accounts_payable_id: string;
  sales_revenue_id: string;
  cogs_account_id: string; // Cost of Goods Sold
}

interface AccountTypeCodes {
  asset_prefix: string;
  liability_prefix: string;
  equity_prefix: string;
  revenue_prefix: string;
  expense_prefix: string;
}

const AccountingSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'defaults' | 'codes'>('defaults');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form States
  const [availableAccounts, setAvailableAccounts] = useState<AccountOption[]>([]);
  const [defaultAccounts, setDefaultAccounts] = useState<DefaultAccounts>({
    inventory_account_id: '',
    accounts_receivable_id: '',
    accounts_payable_id: '',
    sales_revenue_id: '',
    cogs_account_id: ''
  });
  const [typeCodes, setTypeCodes] = useState<AccountTypeCodes>({
    asset_prefix: '1000',
    liability_prefix: '2000',
    equity_prefix: '3000',
    revenue_prefix: '4000',
    expense_prefix: '5000'
  });

  // --- Fetch Data ---
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // Fetch dropdown options for the Chart of Accounts
        const accountsRes = await api.get('/accounting/accounts/');
        setAvailableAccounts(accountsRes.data);

        // Fetch current accounting settings
        const settingsRes = await api.get('/accounting/settings/');
        setDefaultAccounts(settingsRes.data.default_accounts || {});
        setTypeCodes(settingsRes.data.account_type_codes || {});
      } catch (err) {
        console.error("Failed to load accounting settings", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // --- Handlers ---
  const handleSaveDefaults = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.put('/accounting/settings/defaults/', defaultAccounts);
      alert('✅ Default accounts updated successfully.');
    } catch (err: any) {
      alert(`Failed to save: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.put('/accounting/settings/codes/', typeCodes);
      alert('✅ Account type codes updated successfully.');
    } catch (err: any) {
      alert(`Failed to save: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-10 text-center text-gray-500 font-medium">Loading Settings...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-2xl font-black text-gray-800 tracking-tight">Accounting Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Configure ledger mappings and chart of account numbering rules.</p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 bg-white px-2 pt-2 rounded-t-xl shadow-sm">
        <button
          onClick={() => setActiveTab('defaults')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'defaults' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Default Accounts
        </button>
        <button
          onClick={() => setActiveTab('codes')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'codes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Account Type Codes
        </button>
      </div>

      {/* Tab Content: Default Accounts */}
      {activeTab === 'defaults' && (
        <div className="bg-white p-6 rounded-b-xl shadow-sm border border-gray-200 border-t-0 animate-fade-in">
          <form onSubmit={handleSaveDefaults} className="space-y-5">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Accounts Receivable</label>
                <p className="text-xs text-gray-500 mb-2">Default ledger for customer debts.</p>
                <select 
                  value={defaultAccounts.accounts_receivable_id} 
                  onChange={(e) => setDefaultAccounts({...defaultAccounts, accounts_receivable_id: e.target.value})}
                  className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                >
                  <option value="">Select Account...</option>
                  {availableAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Accounts Payable</label>
                <p className="text-xs text-gray-500 mb-2">Default ledger for vendor debts.</p>
                <select 
                  value={defaultAccounts.accounts_payable_id} 
                  onChange={(e) => setDefaultAccounts({...defaultAccounts, accounts_payable_id: e.target.value})}
                  className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                >
                  <option value="">Select Account...</option>
                  {availableAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Inventory Asset</label>
                <p className="text-xs text-gray-500 mb-2">Holds the value of physical stock on hand.</p>
                <select 
                  value={defaultAccounts.inventory_account_id} 
                  onChange={(e) => setDefaultAccounts({...defaultAccounts, inventory_account_id: e.target.value})}
                  className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                >
                  <option value="">Select Account...</option>
                  {availableAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Sales Revenue</label>
                <p className="text-xs text-gray-500 mb-2">Default destination for point-of-sale income.</p>
                <select 
                  value={defaultAccounts.sales_revenue_id} 
                  onChange={(e) => setDefaultAccounts({...defaultAccounts, sales_revenue_id: e.target.value})}
                  className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                >
                  <option value="">Select Account...</option>
                  {availableAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button 
                type="submit" 
                disabled={isSaving} 
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                {isSaving ? 'Saving...' : 'Save Default Accounts'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab Content: Account Type Codes */}
      {activeTab === 'codes' && (
        <div className="bg-white p-6 rounded-b-xl shadow-sm border border-gray-200 border-t-0 animate-fade-in">
          <form onSubmit={handleSaveCodes} className="space-y-5">
            <p className="text-sm text-gray-600 mb-4 bg-blue-50 p-3 rounded border border-blue-100">
              Define the numbering blocks for your Chart of Accounts. For example, if Assets are set to <strong>1000</strong>, all new Asset accounts will automatically generate codes sequentially (e.g., 1001, 1002).
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Asset Prefix</label>
                <input 
                  type="text" 
                  value={typeCodes.asset_prefix} 
                  onChange={(e) => setTypeCodes({...typeCodes, asset_prefix: e.target.value})}
                  className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                  placeholder="1000"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Liability Prefix</label>
                <input 
                  type="text" 
                  value={typeCodes.liability_prefix} 
                  onChange={(e) => setTypeCodes({...typeCodes, liability_prefix: e.target.value})}
                  className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                  placeholder="2000"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Equity Prefix</label>
                <input 
                  type="text" 
                  value={typeCodes.equity_prefix} 
                  onChange={(e) => setTypeCodes({...typeCodes, equity_prefix: e.target.value})}
                  className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                  placeholder="3000"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Revenue Prefix</label>
                <input 
                  type="text" 
                  value={typeCodes.revenue_prefix} 
                  onChange={(e) => setTypeCodes({...typeCodes, revenue_prefix: e.target.value})}
                  className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                  placeholder="4000"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Expense Prefix</label>
                <input 
                  type="text" 
                  value={typeCodes.expense_prefix} 
                  onChange={(e) => setTypeCodes({...typeCodes, expense_prefix: e.target.value})}
                  className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                  placeholder="5000"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button 
                type="submit" 
                disabled={isSaving} 
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                {isSaving ? 'Saving...' : 'Save Account Codes'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default AccountingSettings;