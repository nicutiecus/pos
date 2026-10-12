import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axiosInstance';

interface Account {
  id: number;
  name: string;
  code: string;
  account_type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
  description: string;
  is_active: boolean;
}

interface Transaction {
  id: number | string;
  date: string;
  reference_id: string;
  description: string;
  debit: number;
  credit: number;
  running_balance?: number;
}

const AccountsDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accountTotals, setAccountTotals] = useState({ debit: 0, credit: 0, balance: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // Date Filters (Default to current month)
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);

  useEffect(() => {
    const fetchAccountData = async () => {
      setIsLoading(true);
      try {
        // Fetch account details
        const accountRes = await api.get('/accounting/accounts/');
        const selectedAcc = accountRes.data.find((acc: Account) => acc.id === Number(id));
        
        if (!selectedAcc) {
          console.error("Account not found");
          setIsLoading(false);
          return;
        }
        
        setAccount(selectedAcc);

        // Fetch general ledger transactions for this account WITH date filters
        const ledgerRes = await api.get(`/accounting/general-ledger/?account_id=${id}&start_date=${startDate}&end_date=${endDate}`);
        
        let runningBal = Number(ledgerRes.data.opening_balance || 0);
        let totalDebit = 0;
        let totalCredit = 0;
        const isDebitNormal = ledgerRes.data.is_debit_normal;

        // Create the Opening Balance row
        const openingRow: Transaction = {
          id: 'opening-balance',
          date: startDate,
          reference_id: '-',
          description: 'Opening Balance',
          debit: 0,
          credit: 0,
          running_balance: runningBal
        };

        const txWithBalances = ledgerRes.data.transactions.map((tx: any) => {
          const debit = Number(tx.debit);
          const credit = Number(tx.credit);
          totalDebit += debit;
          totalCredit += credit;
          
          if (isDebitNormal) {
            runningBal += (debit - credit);
          } else {
            runningBal += (credit - debit);
          }

          return { ...tx, debit, credit, running_balance: runningBal };
        });

        setAccountTotals({
          debit: totalDebit,
          credit: totalCredit,
          balance: runningBal // The final balance at the end of the period
        });

        // Reverse to display newest transactions first, placing the Opening Balance at the very bottom
        setTransactions([...txWithBalances.reverse(), openingRow]);

      } catch (err) {
        console.error("Failed to load account details", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (id) fetchAccountData();
  }, [id, startDate, endDate]);

  if (isLoading && !account) {
    return <div className="p-10 text-center text-gray-500">Loading Account Details...</div>;
  }

  if (!account) {
    return (
      <div className="max-w-5xl mx-auto p-10 text-center">
        <h2 className="text-2xl font-black text-gray-800 mb-4">Account Not Found</h2>
        <button onClick={() => navigate(-1)} className="text-blue-600 font-bold hover:underline">
          &larr; Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <button 
          onClick={() => navigate(-1)}
          className="text-gray-500 hover:text-gray-900 text-sm font-bold mb-4 inline-flex items-center transition-colors"
        >
          &larr; Back to Chart of Accounts
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-black text-gray-900">{account.name}</h2>
            <div className="flex gap-4 mt-2 text-sm">
              <p><span className="text-gray-500">Code:</span> <span className="font-mono font-bold text-gray-800">{account.code}</span></p>
              <p><span className="text-gray-500">Type:</span> <span className="font-bold text-gray-800">{account.account_type}</span></p>
              <p><span className="text-gray-500">Status:</span> 
                <span className={`ml-1 font-bold ${account.is_active ? 'text-green-600' : 'text-red-600'}`}>
                  {account.is_active ? 'Active' : 'Inactive'}
                </span>
              </p>
            </div>
            {account.description && <p className="mt-4 text-gray-600 text-sm">{account.description}</p>}
          </div>
        </div>
      </div>

      {/* Date Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap gap-4 items-center">
        <div className="flex flex-col">
          <label className="text-xs font-bold text-gray-500 uppercase mb-1">Start Date</label>
          <input 
            type="date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs font-bold text-gray-500 uppercase mb-1">End Date</label>
          <input 
            type="date" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-blue-500">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Closing Balance</p>
          <p className="text-3xl font-black text-gray-900">₦{accountTotals.balance.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Period Debit</p>
          <p className="text-2xl font-bold text-gray-700">₦{accountTotals.debit.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Period Credit</p>
          <p className="text-2xl font-bold text-gray-700">₦{accountTotals.credit.toLocaleString()}</p>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
        
        {/* Loading Overlay for Data Refresh */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        <div className="bg-gray-50 p-4 border-b border-gray-200">
          <h3 className="font-bold text-gray-800">Transaction History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Reference</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Description</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Debit</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Credit</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((tx, idx) => {
                const isOpeningRow = tx.id === 'opening-balance';
                
                return (
                  <tr key={idx} className={isOpeningRow ? "bg-blue-50/30" : "hover:bg-gray-50"}>
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">{tx.date}</td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-600">{tx.reference_id || '-'}</td>
                    <td className={`px-6 py-4 text-sm ${isOpeningRow ? 'font-bold italic text-gray-700' : 'font-medium text-gray-900'}`}>{tx.description}</td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-700 text-right">{tx.debit > 0 ? `₦${tx.debit.toLocaleString()}` : '-'}</td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-700 text-right">{tx.credit > 0 ? `₦${tx.credit.toLocaleString()}` : '-'}</td>
                    <td className="px-6 py-4 text-sm font-black text-gray-900 text-right">₦{tx.running_balance?.toLocaleString()}</td>
                  </tr>
                );
              })}
              {transactions.length === 1 && transactions[0].id === 'opening-balance' && (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">No transactions recorded for this account in the selected period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default AccountsDetails;