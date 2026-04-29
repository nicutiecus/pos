import React, { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';

// --- Interfaces representing the expected Django JSON response ---
interface PaymentMethodTotal {
  method: string;
  total_amount: number;
  transaction_type: string;
}

interface ItemSold {
  product_name: string;
  total_quantity: number;
  item_profit: number;
  total_cost: number;
  total_revenue: number;
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

  // --- MATRIX TRANSFORMATION LOGIC ---
  const paymentMethods = ['POS', 'Transfer', 'Cash'] as const;
  const transactionTypes = ['Sales', 'Debt Payment'] as const;

  // Initialize an empty matrix
  const matrixData = {
    'POS': { 'Sales': 0, 'Debt Payment': 0 },
    'Transfer': { 'Sales': 0, 'Debt Payment': 0 },
    'Cash': { 'Sales': 0, 'Debt Payment': 0 },
  };

  // Populate the matrix with data from the API
  if (reportData?.payment_methods_breakdown) {
    reportData.payment_methods_breakdown.forEach((pm) => {
      // Ensure the method and type match our predefined keys before adding to prevent errors
      if (
        (pm.method === 'POS' || pm.method === 'Transfer' || pm.method === 'Cash') &&
        (pm.transaction_type === 'Sales' || pm.transaction_type === 'Debt Payment')
      ) {
        matrixData[pm.method][pm.transaction_type] += Number(pm.total_amount);
      }
    });
  }

  // Calculation Helpers
  const calculateColumnTotal = (type: typeof transactionTypes[number]) => {
    return paymentMethods.reduce((sum, method) => sum + matrixData[method][type], 0);
  };

  const calculateRowTotal = (method: typeof paymentMethods[number]) => {
    return transactionTypes.reduce((sum, type) => sum + matrixData[method][type], 0);
  };

  const grandTotal = paymentMethods.reduce((sum, method) => sum + calculateRowTotal(method), 0);

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
                    {/* Payment Breakdown Matrix */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800">Payment Breakdown</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-left">
                                <thead className="bg-gray-800 text-white">
                                    <tr>
                                        <th className="px-3 py-3 font-bold uppercase tracking-wider text-[10px] border-r border-gray-700">
                                            Method
                                        </th>
                                        {transactionTypes.map(type => (
                                            <th key={type} className="px-3 py-3 font-bold uppercase tracking-wider text-[10px] text-right">
                                                {type}
                                            </th>
                                        ))}
                                        <th className="px-3 py-3 font-bold uppercase tracking-wider text-[10px] text-right border-l border-gray-700 bg-gray-900">
                                            Total
                                        </th>
                                    </tr>
                                </thead>
                                
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {paymentMethods.map(method => (
                                        <tr key={method} className="hover:bg-gray-50 transition-colors">
                                            <th className="px-3 py-3 font-bold text-gray-800 bg-gray-50 border-r border-gray-200 text-xs">
                                                {method}
                                            </th>
                                            {transactionTypes.map(type => (
                                                <td key={`${method}-${type}`} className="px-3 py-3 text-gray-700 font-medium text-right text-xs">
                                                    ₦{matrixData[method][type].toLocaleString()}
                                                </td>
                                            ))}
                                            <td className="px-3 py-3 text-gray-900 font-bold text-right border-l border-gray-200 bg-gray-50 text-xs">
                                                ₦{calculateRowTotal(method).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                
                                <tfoot className="bg-blue-50 border-t-2 border-blue-200">
                                    <tr>
                                        <th className="px-3 py-3 font-black text-blue-900 border-r border-blue-200 uppercase tracking-wider text-[10px]">
                                            Grand
                                        </th>
                                        {transactionTypes.map(type => (
                                            <td key={`total-${type}`} className="px-3 py-3 font-black text-blue-900 text-right text-xs">
                                                ₦{calculateColumnTotal(type).toLocaleString()}
                                            </td>
                                        ))}
                                        <td className="px-3 py-3 font-black text-blue-900 text-right border-l border-blue-200 text-sm">
                                            ₦{grandTotal.toLocaleString()}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
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
                                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Total Cost</th>
                                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Total Revenue</th>
                                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Total Profit</th>
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
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-blue-600 text-right">
                                                    {Number(item.total_cost).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-blue-600 text-right">
                                                    {Number(item.total_revenue).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-blue-600 text-right">
                                                    {Number(item.item_profit).toLocaleString()}
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