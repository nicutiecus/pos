import React, { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';

// --- Interfaces representing the expected Django JSON response ---
interface PaymentMethodTotal {
  method: string;
  total_amount: number;
}

interface ItemSold {
  product_name: string;
  total_quantity: number;
}

interface PriceChange {
  product: string;
  old_price: number;
  new_price: number;
  changed_at: string;
  changed_by: string;
}

export interface EODReportData {
  summary:{
  total_sales_revenue: number;
  total_sales_profit: number;
  total_debt_repayment_collected: number;
  total_credit_sales: number;
  number_of_active_cashiers: number;
}
  payment_methods_breakdown: PaymentMethodTotal[];
  items_sold_breakdown: ItemSold[];
  intra_day_price_changes: PriceChange[];
}

interface Branch {
  id: string;
  name: string;
}

const AdminEODReport: React.FC = () => {
  // --- State ---
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  
  // Default to today's date
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [reportData, setReportData] = useState<EODReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Fetch Branches on Load ---
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await api.get('/branches/');
        const branchList = res.data.results || res.data;
        setBranches(branchList);
        
        // Auto-select the first branch if available
        if (branchList.length > 0) {
          setSelectedBranchId(branchList[0].id);
        }
      } catch (err) {
        console.error("Failed to load branches", err);
      }
    };
    fetchBranches();
  }, []);

  // --- Fetch EOD Report when Branch or Date changes ---
  useEffect(() => {
    if (!selectedBranchId || !selectedDate) return;

    const fetchReport = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // NOTE: Adjust this URL to match your Django EOD endpoint
        const response = await api.get(`/reports/eod/${selectedBranchId}`, {
          params: { 
            branch_id: selectedBranchId, 
            date: selectedDate 
          }
        });
        setReportData(response.data);
      } catch (err: any) {
        console.error("Failed to fetch EOD report:", err);
        setError(err.response?.data?.message || err.response?.data?.detail || "Failed to load report data.");
        setReportData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReport();
  }, [selectedBranchId, selectedDate]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4">
      
      {/* HEADER & FILTERS */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">End of Day Report</h2>
          <p className="text-sm text-gray-500">Comprehensive daily financial and operational audit.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3">
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full sm:w-auto p-3 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-sm bg-white"
          />

          <select 
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="w-full sm:w-64 p-3 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-sm bg-white"
          >
            <option value="" disabled>-- Select Branch --</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-sm">
          <p className="font-bold">Notice</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center h-64 text-gray-500 bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
            Compiling End of Day data...
        </div>
      ) : reportData ? (
        <div className="space-y-6 animate-fade-in-up">
            
            {/* KPI CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-blue-500">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Sales Revenue</p>
                    <p className="text-2xl font-black text-gray-900">₦{Number(reportData.summary?.total_sales_revenue || 0).toLocaleString()}</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-green-500">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Sales Profit</p>
                    <p className="text-2xl font-black text-gray-900">₦{Number(reportData.summary?.total_sales_profit || 0).toLocaleString()}</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-purple-500">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Debt Repayments Collected</p>
                    <p className="text-2xl font-black text-gray-900">₦{Number(reportData.summary?.total_debt_repayment_collected || 0).toLocaleString()}</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-purple-500">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Credit Sales</p>
                    <p className="text-2xl font-black text-gray-900">₦{Number(reportData.summary?.total_credit_sales || 0).toLocaleString()}</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-orange-500">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Active Cashiers</p>
                    <p className="text-2xl font-black text-gray-900">{reportData.summary?.number_of_active_cashiers || 0} <span className="text-sm font-medium text-gray-500">Staff</span></p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* LEFT COLUMN */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Payment Breakdown */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gray-50 p-4 border-b border-gray-200">
                            <h3 className="font-bold text-gray-800">Payment Breakdown</h3>
                        </div>
                        <div className="p-4 space-y-3">
                            {(reportData.payment_methods_breakdown || []).length > 0 ? (
                                (reportData.payment_methods_breakdown || []).map((pm, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-100">
                                        <span className="font-bold text-gray-700">{pm.method}</span>
                                        <span className="font-black text-gray-900">₦{Number(pm.total_amount).toLocaleString()}</span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-gray-500 italic text-center py-4">No payments recorded.</p>
                            )}
                        </div>
                    </div>

                    {/* Price Changes Tracker */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-red-50 p-4 border-b border-red-100 flex justify-between items-center">
                            <h3 className="font-bold text-red-900">Price Change Alerts</h3>
                            <span className="bg-red-200 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded-full">{(reportData.intra_day_price_changes|| []).length}</span>
                        </div>
                        <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                            {(reportData.intra_day_price_changes || []).length > 0 ? (
                                (reportData.intra_day_price_changes || []).map((pc, idx) => (
                                    <div key={idx} className="p-4">
                                        <div className="flex justify-between mb-1">
                                            <span className="font-bold text-sm text-gray-900">{pc.product}</span>
                                            <span className="text-xs text-gray-500">{pc.changed_at}</span>
                                        </div>
                                        <div className="flex items-center space-x-2 text-sm mt-1">
                                            <span className="text-gray-500 line-through">₦{Number(pc.old_price).toLocaleString()}</span>
                                            <span className="text-gray-400">→</span>
                                            <span className="font-bold text-blue-600">₦{Number(pc.new_price).toLocaleString()}</span>
                                        </div>
                                        <div className="text-[10px] text-gray-400 mt-2 uppercase tracking-wider">
                                            Changed by: {pc.changed_by}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-gray-500 italic text-center py-8">No price changes occurred today.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="lg:col-span-2">
                    {/* Items Sold Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
                        <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center shrink-0">
                            <h3 className="font-bold text-gray-800">Items Sold Breakdown</h3>
                            <span className="text-xs text-gray-500">{(reportData.items_sold_breakdown || []).length} unique products</span>
                        </div>
                        <div className="flex-1 overflow-auto max-h-[600px]">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-white sticky top-0 shadow-sm z-10">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Product Name</th>
                                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Total Qty Sold</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {(reportData.items_sold_breakdown || []).length > 0 ? (
                                        (reportData.items_sold_breakdown || []).map((item, idx) => (
                                            <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                                    {item.product_name}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-blue-600 text-right">
                                                    {Number(item.total_quantity).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={2} className="px-6 py-12 text-center text-sm text-gray-500 italic">
                                                No items were sold on this date.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

            </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminEODReport;