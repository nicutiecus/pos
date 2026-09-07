import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axiosInstance';

// --- Interfaces ---
interface FinancialAccount {
  id: string;
  name: string;
  type: 'Cash' | 'POS' | 'Transfer' | 'Bank';
  account_number?: string;
  opening_balance: string | number;
  total_receipts: string | number;
  total_payments: string | number;
  closing_balance: string | number;
}

const CashBankAccounts: React.FC = () => {
  const navigate = useNavigate();
  
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- Fetch Data ---
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await api.get('/accounting/cash-bank-accounts/');
        setAccounts(response.data);
      } catch (err) {
        console.error("Failed to load cash and bank accounts", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAccounts();
  }, []);

  // --- Derived State ---
  const totalLiquidity = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + Number(acc.closing_balance), 0);
  }, [accounts]);

  const totalCash = useMemo(() => {
    return accounts
      .filter(acc => acc.type === 'Cash')
      .reduce((sum, acc) => sum + Number(acc.closing_balance), 0);
  }, [accounts]);

  const userRole = localStorage.getItem('userRole');
  const routePrefix = userRole === 'Tenant_Admin' || userRole === 'ADMIN' ? '/admin' : '/manager';

  if (isLoading) {
    return <div className="p-10 text-center text-gray-500 font-medium">Loading Accounts...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">Cash & Bank Accounts</h2>
          <p className="text-sm text-gray-500">Monitor liquidity across cash drawers, POS settlements, and bank transfers.</p>
        </div>
        <button 
          onClick={() => navigate(`${routePrefix}/accounting/journal`)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm"
        >
          Post Manual Entry
        </button>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-green-500">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Total System Liquidity</p>
          <p className="text-3xl font-black text-gray-900">
            ₦{totalLiquidity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-blue-500">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Cash on Hand</p>
          <p className="text-3xl font-bold text-gray-700">
            ₦{totalCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 p-4 border-b border-gray-200">
          <h3 className="font-bold text-gray-800">Financial Accounts Overview</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Account Name</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Opening Balance</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Receipts (+)</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Payments (-)</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-900 uppercase bg-gray-50">Closing Balance (=)</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    No financial accounts configured.
                  </td>
                </tr>
              ) : (
                accounts.map((account) => (
                  <tr key={account.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${account.type === 'Cash' ? 'bg-blue-500' : account.type === 'POS' ? 'bg-purple-500' : 'bg-green-500'}`}></span>
                        <div>
                          <div className="text-sm font-bold text-gray-900">{account.name}</div>
                          <div className="text-xs text-gray-400">{account.type} {account.account_number ? `• ${account.account_number}` : ''}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right font-medium">
                      ₦{Number(account.opening_balance).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-bold bg-green-50/10">
                      + ₦{Number(account.total_receipts).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 font-bold bg-red-50/10">
                      - ₦{Number(account.total_payments).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right bg-gray-50 group-hover:bg-blue-50/50 transition-colors">
                      <span className="font-black text-gray-900 text-base">
                        ₦{Number(account.closing_balance).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => navigate(`${routePrefix}/accounting/accounts/${account.id}/transactions`)}
                        className="text-blue-600 hover:text-blue-800 font-bold text-xs uppercase tracking-wider bg-blue-50 px-3 py-1.5 rounded transition-colors border border-blue-100"
                      >
                        View Ledger
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default CashBankAccounts;