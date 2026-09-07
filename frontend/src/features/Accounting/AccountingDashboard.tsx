import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../../api/axiosInstance';

// --- Interfaces ---
interface PLTotals {
  total_revenue: number;
  gross_profit: number;
  net_profit: number;
}

interface Liquidity {
  cash: number;
  bank: number;
  receivables: number;
  payables: number;
}

interface Receivable {
  id: string;
  name: string;
  current_debt: number;
}

interface Payable {
  id: string;
  name: string;
  current_debt: number;
}

interface JournalEntry {
  id: number;
  date: string;
  reference_id: string;
  description: string;
  lines: { debit: number; credit: number }[];
}

interface BranchPerformance {
  branch_name: string;
  revenue: number;
  cogs: number;
  gross_profit: number;
  expenses: number;
  net_profit: number;
}

const AccountingDashboard: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [plTotals, setPlTotals] = useState<PLTotals>({ total_revenue: 0, gross_profit: 0, net_profit: 0 });
  const [liquidity, setLiquidity] = useState<Liquidity>({ cash: 0, bank: 0, receivables: 0, payables: 0 });
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [recentActivity, setRecentActivity] = useState<JournalEntry[]>([]);
  const [branchData, setBranchData] = useState<BranchPerformance[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const [plRes, cbRes, recRes, payRes, journalRes] = await Promise.all([
          api.get('/accounting/reports/profit-loss/'),
          api.get('/accounting/cash-bank/'),
          api.get('/accounting/receivables/'),
          api.get('/accounting/payables/'),
          api.get('/accounting/journals/')
        ]);

        setPlTotals(plRes.data.totals);
        
        const cashBal = cbRes.data.filter((a: any) => a.name.toLowerCase().includes('cash')).reduce((sum: number, a: any) => sum + Number(a.net_balance), 0);
        const bankBal = cbRes.data.filter((a: any) => a.name.toLowerCase().includes('bank') || a.name.toLowerCase().includes('transfer')).reduce((sum: number, a: any) => sum + Number(a.net_balance), 0);
        const totalRec = recRes.data.reduce((sum: number, c: any) => sum + Number(c.current_debt), 0);
        const totalPay = payRes.data.reduce((sum: number, s: any) => sum + Number(s.current_debt), 0);
        
        setLiquidity({ cash: cashBal, bank: bankBal, receivables: totalRec, payables: totalPay });
        setReceivables(recRes.data.slice(0, 5));
        setPayables(payRes.data.slice(0, 5));
        setRecentActivity(journalRes.data.slice(0, 5));

        // Mocking chart data based on PL totals for presentation
        setChartData([{
          name: 'Current Period',
          Revenue: plRes.data.totals.total_revenue,
          COGS: plRes.data.totals.total_cogs,
          Expenses: plRes.data.totals.total_operating_expenses
        }]);

        // Placeholder for branch performance (requires a dedicated aggregate endpoint)
        setBranchData([{
            branch_name: 'HQ',
            revenue: plRes.data.totals.total_revenue,
            cogs: plRes.data.totals.total_cogs,
            gross_profit: plRes.data.totals.gross_profit,
            expenses: plRes.data.totals.total_operating_expenses,
            net_profit: plRes.data.totals.net_profit
        }]);

      } catch (error) {
        console.error("Failed to load accounting dashboard data", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (isLoading) return <div className="p-10 text-center text-gray-500">Loading Financial Data...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-2xl font-black text-gray-800 tracking-tight">Accounting Dashboard</h2>
        <p className="text-sm text-gray-500">Real-time financial overview and ledger activity.</p>
      </div>

      {/* Financial Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-blue-500">
          <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Revenue</div>
          <div className="text-3xl font-black text-gray-900">₦{plTotals.total_revenue.toLocaleString()}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-indigo-500">
          <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Gross Profit</div>
          <div className="text-3xl font-black text-gray-900">₦{plTotals.gross_profit.toLocaleString()}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-green-500">
          <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Net Profit</div>
          <div className="text-3xl font-black text-gray-900">₦{plTotals.net_profit.toLocaleString()}</div>
        </div>
      </div>

      {/* Liquidity */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-center">
          <p className="text-xs font-bold text-gray-500 uppercase">Cash on Hand</p>
          <p className="text-xl font-bold text-gray-800 mt-1">₦{liquidity.cash.toLocaleString()}</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-center">
          <p className="text-xs font-bold text-gray-500 uppercase">Bank / Transfer</p>
          <p className="text-xl font-bold text-gray-800 mt-1">₦{liquidity.bank.toLocaleString()}</p>
        </div>
        <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 text-center">
          <p className="text-xs font-bold text-orange-600 uppercase">Receivables</p>
          <p className="text-xl font-bold text-gray-800 mt-1">₦{liquidity.receivables.toLocaleString()}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-xl border border-red-200 text-center">
          <p className="text-xs font-bold text-red-600 uppercase">Payables</p>
          <p className="text-xl font-bold text-gray-800 mt-1">₦{liquidity.payables.toLocaleString()}</p>
        </div>
      </div>

      {/* Chart & Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Profitability Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col h-96">
          <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">Profitability Analysis</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `₦${value/1000}k`} />
              <Tooltip cursor={{ fill: '#F3F4F6' }} 
              formatter={(value: number | undefined ) => value !== undefined ? `₦${value.toLocaleString()}` : `₦0` } />
              <Legend />
              <Bar dataKey="Revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="COGS" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Receivables & Payables */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-orange-50 p-3 border-b border-orange-100">
              <h3 className="font-bold text-orange-900 text-sm">Top Receivables</h3>
            </div>
            <ul className="divide-y divide-gray-100">
              {receivables.map(r => (
                <li key={r.id} className="p-3 flex justify-between text-sm">
                  <span className="font-medium text-gray-700">{r.name}</span>
                  <span className="font-bold text-orange-600">₦{Number(r.current_debt).toLocaleString()}</span>
                </li>
              ))}
              {receivables.length === 0 && <li className="p-3 text-center text-sm text-gray-400">No pending receivables.</li>}
            </ul>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-red-50 p-3 border-b border-red-100">
              <h3 className="font-bold text-red-900 text-sm">Top Payables</h3>
            </div>
            <ul className="divide-y divide-gray-100">
              {payables.map(p => (
                <li key={p.id} className="p-3 flex justify-between text-sm">
                  <span className="font-medium text-gray-700">{p.name}</span>
                  <span className="font-bold text-red-600">₦{Number(p.current_debt).toLocaleString()}</span>
                </li>
              ))}
              {payables.length === 0 && <li className="p-3 text-center text-sm text-gray-400">No pending payables.</li>}
            </ul>
          </div>
        </div>
      </div>

      {/* Recent Accounting Activity */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 p-4 border-b border-gray-200">
          <h3 className="font-bold text-gray-800">Recent Journal Entries</h3>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentActivity.map(entry => {
                const totalDebit = entry.lines.reduce((sum, line) => sum + Number(line.debit), 0);
                const totalCredit = entry.lines.reduce((sum, line) => sum + Number(line.credit), 0);
                return (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">{entry.reference_id || '-'}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 truncate max-w-xs">{entry.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700 text-right">₦{totalDebit.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700 text-right">₦{totalCredit.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Branch Performance */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 p-4 border-b border-gray-200">
          <h3 className="font-bold text-gray-800">Branch Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Branch</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Revenue</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">COGS</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Gross Profit</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Expenses</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Net Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {branchData.map((branch, idx) => (
                <tr key={idx} className="hover:bg-blue-50/50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{branch.branch_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 text-right font-medium">₦{branch.revenue.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-500 text-right font-medium">₦{branch.cogs.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">₦{branch.gross_profit.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-500 text-right font-medium">₦{branch.expenses.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 text-right font-black">₦{branch.net_profit.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default AccountingDashboard;