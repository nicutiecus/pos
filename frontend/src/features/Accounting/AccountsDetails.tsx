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
  id: number;
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

  useEffect(() => {
    const fetchAccountData = async () => {
      setIsLoading(true);
      try {
        // Fetch account details (filtering from list since we didn't explicitly build a GET detail endpoint)
        const accountRes = await api.get('/accounting/accounts/');
        const selectedAcc = accountRes.data.find((acc: Account) => acc.id === Number(id));
        
        if (!selectedAcc) {
          console.error("Account not found");
          setIsLoading(false);
          return;
        }
        
        setAccount(selectedAcc);

        // Fetch general ledger transactions for this account
        const ledgerRes = await api.get(`/accounting/general-ledger/?account_id=${id}`);
        
        let runningBal = 0;
        let totalDebit = 0;
        let totalCredit = 0;
        const isDebitNormal = selectedAcc.account_type === 'Asset' || selectedAcc.account_type === 'Expense';

        const txWithBalances = ledgerRes.data.map((tx: any) => {
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
          balance: runningBal
        });

        // Reverse to display newest transactions first
        setTransactions(txWithBalances.reverse());

      } catch (err) {
        console.error("Failed to load account details", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (id) fetchAccountData();
  }, [id]);

  if (isLoading) {
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-blue-500">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Current Balance</p>
          <p className="text-3xl font-black text-gray-900">₦{accountTotals.balance.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Total Debit</p>
          <p className="text-2xl font-bold text-gray-700">₦{accountTotals.debit.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Total Credit</p>
          <p className="text-2xl font-bold text-gray-700">₦{accountTotals.credit.toLocaleString()}</p>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
              {transactions.map((tx, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">{tx.date}</td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-600">{tx.reference_id || '-'}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{tx.description}</td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-700 text-right">{tx.debit > 0 ? `₦${tx.debit.toLocaleString()}` : '-'}</td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-700 text-right">{tx.credit > 0 ? `₦${tx.credit.toLocaleString()}` : '-'}</td>
                  <td className="px-6 py-4 text-sm font-black text-gray-900 text-right">₦{tx.running_balance?.toLocaleString()}</td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">No transactions recorded for this account.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default AccountsDetails;