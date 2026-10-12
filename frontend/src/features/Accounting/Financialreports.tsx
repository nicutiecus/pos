import React, { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';

const FinancialReports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tb' | 'pl' | 'bs' | 'cf' | 'tax'>('tb');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Date Filters
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  
  const [asOfDate, setAsOfDate] = useState(today);
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(today);

  // Data States
  const [tbData, setTbData] = useState<any>(null);
  const [plData, setPlData] = useState<any>(null);
  const [bsData, setBsData] = useState<any>(null);
  const [cfData, setCfData] = useState<any>(null);
  const [taxData, setTaxData] = useState<any>(null);

  const fetchReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (activeTab === 'tb') {
        const res = await api.get(`/accounting/trial-balance/?as_of_date=${asOfDate}`);
        setTbData(res.data);
      } else if (activeTab === 'pl') {
        const res = await api.get(`/accounting/reports/profit-loss/?start_date=${startDate}&end_date=${endDate}`);
        setPlData(res.data);
      } else if (activeTab === 'bs') {
        const res = await api.get(`/accounting/reports/balance-sheet/?as_of_date=${asOfDate}`);
        setBsData(res.data);
      } else if (activeTab === 'cf') {
        const res = await api.get(`/accounting/reports/cash-flow/?start_date=${startDate}&end_date=${endDate}`);
        setCfData(res.data);
      } else if (activeTab === 'tax') {
        const res = await api.get(`/accounting/reports/tax/?start_date=${startDate}&end_date=${endDate}`);
        setTaxData(res.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load report data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeTab, asOfDate, startDate, endDate]);

  const isPeriodReport = ['pl', 'cf', 'tax'].includes(activeTab);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">Financial Reports</h2>
          <p className="text-sm text-gray-500">Core accounting reports and financial statements.</p>
        </div>
        
        {/* Date Filters */}
        <div className="flex gap-3">
          {isPeriodReport ? (
            <>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="p-2 border rounded-lg text-sm" />
              <span className="self-center text-gray-500">to</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="p-2 border rounded-lg text-sm" />
            </>
          ) : (
            <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="p-2 border rounded-lg text-sm" />
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {[
          { id: 'tb', label: 'Trial Balance' },
          { id: 'pl', label: 'Profit & Loss' },
          { id: 'bs', label: 'Balance Sheet' },
          { id: 'cf', label: 'Cash Flow' },
          { id: 'tax', label: 'Tax Report' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === tab.id ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 min-h-[400px]">
        {isLoading ? (
          <div className="flex justify-center items-center h-64 text-gray-500">Loading report...</div>
        ) : error ? (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
        ) : (
          <div className="animate-fade-in">
            {/* TRIAL BALANCE */}
            {activeTab === 'tb' && tbData && (
              <div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Account</th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Debit</th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tbData.accounts.map((acc: any) => (
                      <tr key={acc.id}>
                        <td className="px-6 py-3 text-sm text-gray-900">{acc.code} - {acc.name}</td>
                        <td className="px-6 py-3 text-sm text-right font-medium">{Number(acc.total_debit) > 0 ? `₦${Number(acc.total_debit).toLocaleString()}` : '-'}</td>
                        <td className="px-6 py-3 text-sm text-right font-medium">{Number(acc.total_credit) > 0 ? `₦${Number(acc.total_credit).toLocaleString()}` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 font-bold">
                    <tr>
                      <td className="px-6 py-4 text-right">Grand Totals:</td>
                      <td className="px-6 py-4 text-right text-blue-700">₦{Number(tbData.grand_totals.total_debit).toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-blue-700">₦{Number(tbData.grand_totals.total_credit).toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

           {/* PROFIT & LOSS */}
            {activeTab === 'pl' && plData && (
              <div className="space-y-6 max-w-4xl mx-auto">
                
                {/* Sales Revenue */}
                <div>
                  <h3 className="text-lg font-bold text-gray-800 border-b pb-2 mb-3">Sales Revenue</h3>
                  {plData.sales_revenue.map((acc: any) => (
                    <div key={acc.id} className="flex justify-between text-sm py-1 border-b border-gray-50"><span className="text-gray-600">{acc.code} - {acc.name}</span><span className="font-medium">₦{Number(acc.net_balance).toLocaleString()}</span></div>
                  ))}
                  <div className="flex justify-between font-bold text-sm pt-2 mt-2"><span className="text-gray-800">Total Sales Revenue</span><span className="text-blue-600">₦{Number(plData.totals.total_sales_revenue).toLocaleString()}</span></div>
                </div>

                {/* COGS */}
                <div>
                  <h3 className="text-lg font-bold text-gray-800 border-b pb-2 mb-3">Cost of Sales</h3>
                  {plData.cogs.map((acc: any) => (
                    <div key={acc.id} className="flex justify-between text-sm py-1 border-b border-gray-50"><span className="text-gray-600">{acc.code} - {acc.name}</span><span className="font-medium">₦{Number(acc.net_balance).toLocaleString()}</span></div>
                  ))}
                  <div className="flex justify-between font-black text-sm pt-3 mt-2 border-t border-gray-200 bg-gray-50 p-3 rounded">
                    <span className="text-gray-800">Gross Profit</span>
                    <span className="text-green-600">₦{Number(plData.totals.gross_profit).toLocaleString()}</span>
                  </div>
                </div>

                {/* Other Operating Revenue */}
                {plData.other_operating_revenue?.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 border-b pb-2 mb-3">Other Operating Revenue</h3>
                    {plData.other_operating_revenue.map((acc: any) => (
                      <div key={acc.id} className="flex justify-between text-sm py-1 border-b border-gray-50"><span className="text-gray-600">{acc.code} - {acc.name}</span><span className="font-medium text-blue-600">₦{Number(acc.net_balance).toLocaleString()}</span></div>
                    ))}
                  </div>
                )}

                {/* Operating Expenses */}
                <div>
                  <h3 className="text-lg font-bold text-gray-800 border-b pb-2 mb-3">Operating Expenses</h3>
                  {plData.operating_expenses.map((acc: any) => (
                    <div key={acc.id} className="flex justify-between text-sm py-1 border-b border-gray-50"><span className="text-gray-600">{acc.code} - {acc.name}</span><span className="font-medium">₦{Number(acc.net_balance).toLocaleString()}</span></div>
                  ))}
                  <div className="flex justify-between font-bold text-sm pt-2 mt-2"><span className="text-gray-800">Total Operating Expenses</span><span className="text-red-600">₦{Number(plData.totals.total_operating_expenses).toLocaleString()}</span></div>
                </div>

                {/* Operating Profit */}
                <div className="flex justify-between font-black text-sm pt-3 mt-2 border-t border-gray-200 bg-gray-50 p-3 rounded">
                  <span className="text-gray-800">Operating Profit (EBIT)</span>
                  <span className={Number(plData.totals.operating_profit) >= 0 ? 'text-green-600' : 'text-red-600'}>₦{Number(plData.totals.operating_profit).toLocaleString()}</span>
                </div>

                {/* Non-Operating Activity */}
                {(plData.other_income?.length > 0 || plData.finance_costs?.length > 0 || plData.other_expenses?.length > 0) && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 border-b pb-2 mb-3">Non-Operating Income & Expenses</h3>
                    {plData.other_income?.map((acc: any) => (
                      <div key={acc.id} className="flex justify-between text-sm py-1 border-b border-gray-50"><span className="text-gray-600">{acc.code} - {acc.name} (Income)</span><span className="font-medium text-green-600">₦{Number(acc.net_balance).toLocaleString()}</span></div>
                    ))}
                    {plData.other_expenses?.map((acc: any) => (
                      <div key={acc.id} className="flex justify-between text-sm py-1 border-b border-gray-50"><span className="text-gray-600">{acc.code} - {acc.name} (Other Expense)</span><span className="font-medium text-red-600">₦{Number(acc.net_balance).toLocaleString()}</span></div>
                    ))}
                    {plData.finance_costs?.map((acc: any) => (
                      <div key={acc.id} className="flex justify-between text-sm py-1 border-b border-gray-50"><span className="text-gray-600">{acc.code} - {acc.name} (Finance Cost)</span><span className="font-medium text-red-600">₦{Number(acc.net_balance).toLocaleString()}</span></div>
                    ))}
                  </div>
                )}

                {/* Profit Before Tax */}
                <div className="flex justify-between font-black text-sm pt-3 mt-2 border-t border-gray-200 bg-gray-50 p-3 rounded">
                  <span className="text-gray-800">Profit Before Tax (EBT)</span>
                  <span className={Number(plData.totals.profit_before_tax) >= 0 ? 'text-green-600' : 'text-red-600'}>₦{Number(plData.totals.profit_before_tax).toLocaleString()}</span>
                </div>

                {/* Tax Expense */}
                {plData.tax_expenses?.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 border-b pb-2 mb-3">Income Tax Expense</h3>
                    {plData.tax_expenses.map((acc: any) => (
                      <div key={acc.id} className="flex justify-between text-sm py-1 border-b border-gray-50"><span className="text-gray-600">{acc.code} - {acc.name}</span><span className="font-medium text-red-600">₦{Number(acc.net_balance).toLocaleString()}</span></div>
                    ))}
                  </div>
                )}

                {/* Final Net Profit */}
                <div className="flex justify-between items-center font-black text-xl pt-6 mt-4 border-t-4 border-gray-900 bg-gray-50 p-4 rounded-b-lg">
                  <span>Net Profit / Income</span>
                  <span className={Number(plData.totals.net_profit) >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {Number(plData.totals.net_profit) >= 0 ? `₦${Number(plData.totals.net_profit).toLocaleString()}` : `(₦${Math.abs(Number(plData.totals.net_profit)).toLocaleString()})`}
                  </span>
                </div>
              </div>
            )}
            {/* BALANCE SHEET */}
            {activeTab === 'bs' && bsData && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Assets */}
                <div>
                  <h3 className="text-lg font-black text-blue-900 border-b-2 border-blue-900 pb-2 mb-3">Assets</h3>
                  {bsData.assets.map((acc: any) => (
                    <div key={acc.id} className="flex justify-between text-sm py-1 border-b border-gray-50"><span className="text-gray-600">{acc.code} - {acc.name}</span><span className="font-medium">₦{Number(acc.net_balance).toLocaleString()}</span></div>
                  ))}
                  <div className="flex justify-between font-bold text-sm pt-3 mt-2"><span className="text-gray-800">Total Assets</span><span className="text-blue-700 text-lg">₦{Number(bsData.totals.total_assets).toLocaleString()}</span></div>
                </div>

                {/* Liabilities & Equity */}
                <div>
                  <h3 className="text-lg font-black text-red-900 border-b-2 border-red-900 pb-2 mb-3">Liabilities</h3>
                  {bsData.liabilities.map((acc: any) => (
                    <div key={acc.id} className="flex justify-between text-sm py-1 border-b border-gray-50"><span className="text-gray-600">{acc.code} - {acc.name}</span><span className="font-medium">₦{Number(acc.net_balance).toLocaleString()}</span></div>
                  ))}
                  <div className="flex justify-between font-bold text-sm pt-3 mt-2 mb-6"><span className="text-gray-800">Total Liabilities</span><span className="text-red-700">₦{Number(bsData.totals.total_liabilities).toLocaleString()}</span></div>

                  <h3 className="text-lg font-black text-green-900 border-b-2 border-green-900 pb-2 mb-3">Equity</h3>
                  {bsData.equity.map((acc: any) => (
                    <div key={acc.id} className="flex justify-between text-sm py-1 border-b border-gray-50"><span className="text-gray-600">{acc.code} - {acc.name}</span><span className="font-medium">₦{Number(acc.net_balance).toLocaleString()}</span></div>
                  ))}
                  
                  {/* Now properly labeled as Current Year Earnings */}
                  <div className="flex justify-between text-sm py-1 border-b border-gray-50">
                    <span className="text-gray-600 font-bold">Current Year Earnings</span>
                    <span className="font-bold text-green-700">₦{Number(bsData.totals.current_year_earnings).toLocaleString()}</span>
                  </div>
                  
                  <div className="flex justify-between font-bold text-sm pt-3 mt-2"><span className="text-gray-800">Total Liabilities & Equity</span><span className="text-gray-900 text-lg">₦{Number(bsData.totals.total_liabilities_and_equity).toLocaleString()}</span></div>
                </div>
              </div>
            )}

          
            {/* CASH FLOW */}
            {activeTab === 'cf' && cfData && (
              <div className="max-w-4xl mx-auto space-y-8">
                
                {/* Operating Activities */}
                <div>
                  <h3 className="text-lg font-black text-gray-800 border-b-2 border-gray-800 pb-2 mb-3">Operating Activities</h3>
                  {cfData.operating_activities.accounts.map((acc: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                      <span className="text-gray-600">{acc.account_code} - {acc.account_name}</span>
                      <span className="font-medium">{Number(acc.net) >= 0 ? `₦${Number(acc.net).toLocaleString()}` : `(₦${Math.abs(Number(acc.net)).toLocaleString()})`}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-sm pt-3 mt-2">
                    <span className="text-gray-800">Net Cash from Operating Activities</span>
                    <span className="text-blue-700">₦{Number(cfData.operating_activities.net_cash).toLocaleString()}</span>
                  </div>
                </div>

                {/* Investing Activities */}
                <div>
                  <h3 className="text-lg font-black text-gray-800 border-b-2 border-gray-800 pb-2 mb-3">Investing Activities</h3>
                  {cfData.investing_activities.accounts.map((acc: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                      <span className="text-gray-600">{acc.account_code} - {acc.account_name}</span>
                      <span className="font-medium">{Number(acc.net) >= 0 ? `₦${Number(acc.net).toLocaleString()}` : `(₦${Math.abs(Number(acc.net)).toLocaleString()})`}</span>
                    </div>
                  ))}
                  {cfData.investing_activities.accounts.length === 0 && (
                     <p className="text-sm text-gray-400 italic py-2">No investing activities for this period.</p>
                  )}
                  <div className="flex justify-between font-bold text-sm pt-3 mt-2">
                    <span className="text-gray-800">Net Cash from Investing Activities</span>
                    <span className="text-blue-700">₦{Number(cfData.investing_activities.net_cash).toLocaleString()}</span>
                  </div>
                </div>

                {/* Financing Activities */}
                <div>
                  <h3 className="text-lg font-black text-gray-800 border-b-2 border-gray-800 pb-2 mb-3">Financing Activities</h3>
                  {cfData.financing_activities.accounts.map((acc: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                      <span className="text-gray-600">{acc.account_code} - {acc.account_name}</span>
                      <span className="font-medium">{Number(acc.net) >= 0 ? `₦${Number(acc.net).toLocaleString()}` : `(₦${Math.abs(Number(acc.net)).toLocaleString()})`}</span>
                    </div>
                  ))}
                  {cfData.financing_activities.accounts.length === 0 && (
                     <p className="text-sm text-gray-400 italic py-2">No financing activities for this period.</p>
                  )}
                  <div className="flex justify-between font-bold text-sm pt-3 mt-2">
                    <span className="text-gray-800">Net Cash from Financing Activities</span>
                    <span className="text-blue-700">₦{Number(cfData.financing_activities.net_cash).toLocaleString()}</span>
                  </div>
                </div>

                {/* Net Change */}
                <div className="flex justify-between items-center font-black text-xl pt-6 mt-4 border-t-4 border-gray-900 bg-gray-50 p-4 rounded-b-lg">
                  <span>Net Increase (Decrease) in Cash</span>
                  <span className={Number(cfData.totals.net_cash_change) >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {Number(cfData.totals.net_cash_change) >= 0 ? `₦${Number(cfData.totals.net_cash_change).toLocaleString()}` : `(₦${Math.abs(Number(cfData.totals.net_cash_change)).toLocaleString()})`}
                  </span>
                </div>

              </div>
            )}

          
           {/* TAX REPORT */}
            {activeTab === 'tax' && taxData && (
              <div className="max-w-4xl mx-auto space-y-8">
                
                {/* 1. Tax Reconciliation */}
                <div>
                  <h3 className="text-lg font-black text-gray-800 border-b-2 border-gray-800 pb-2 mb-3">Corporate Tax Reconciliation</h3>
                  <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Accounting Profit Before Tax</span>
                      <span className="font-bold text-gray-900">₦{Number(taxData?.reconciliation.accounting_profit_before_tax).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Add: Non-Deductible Expenses</span>
                      <span className="font-bold text-red-600">₦{Number(taxData?.reconciliation.non_deductible_expenses).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-black text-base pt-3 mt-2 border-t border-gray-300">
                      <span className="text-gray-800">Adjusted Taxable Profit</span>
                      <span className="text-gray-900">₦{Number(taxData?.reconciliation.taxable_profit).toLocaleString()}</span>
                    </div>
                    
                    <div className="flex justify-between items-center bg-blue-50 p-4 rounded-lg mt-4 border border-blue-100">
                      <div>
                        <span className="font-bold text-blue-900 block">Estimated Tax Expense</span>
                        <span className="text-xs text-blue-700">Calculated at {taxData?.tax_rate_percentage}% of Taxable Profit</span>
                      </div>
                      <span className="text-2xl font-black text-blue-700">₦{Number(taxData?.reconciliation.estimated_tax_expense).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* 2. VAT Position */}
                  <div>
                    <h3 className="text-lg font-black text-gray-800 border-b-2 border-gray-800 pb-2 mb-3">VAT Position</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm border-b border-gray-100 pb-2">
                        <span className="text-gray-600">Output VAT (Collected on Sales)</span>
                        <span className="font-medium text-gray-900">₦{Number(taxData?.balances.output_vat).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm border-b border-gray-100 pb-2">
                        <span className="text-gray-600">Less: Input VAT (Paid on Purchases)</span>
                        <span className="font-medium text-gray-900">(₦{Number(taxData?.balances.input_vat).toLocaleString()})</span>
                      </div>
                      <div className="flex justify-between font-bold text-sm bg-gray-50 p-3 rounded">
                        <span className="text-gray-800">Net VAT Payable</span>
                        <span className="text-orange-600">₦{Number(taxData?.balances.net_vat_payable).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* 3. Withholding & Tax Ledgers */}
                  <div>
                    <h3 className="text-lg font-black text-gray-800 border-b-2 border-gray-800 pb-2 mb-3">Tax Ledger Balances</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm border-b border-gray-100 pb-2">
                        <span className="text-gray-600">WHT Payable</span>
                        <span className="font-medium text-gray-900">₦{Number(taxData?.balances.wht_payable).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm border-b border-gray-100 pb-2">
                        <span className="text-gray-600">Corporate Tax Expense (Ledger)</span>
                        <span className="font-medium text-gray-900">₦{Number(taxData?.balances.tax_expense_ledger).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-bold text-sm bg-gray-50 p-3 rounded">
                        <span className="text-gray-800">Corporate Tax Payable (Ledger)</span>
                        <span className="text-red-600">₦{Number(taxData?.balances.tax_payable_ledger).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancialReports;