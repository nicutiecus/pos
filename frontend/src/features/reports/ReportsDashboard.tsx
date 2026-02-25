import React, { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';

// --- Interfaces ---
interface Branch {
  id: number;
  name: string;
}

interface ReportSummary {
  total_revenue: number;
  total_orders: number;
  average_order_value: number;
  total_cost?: number; // Optional: If backend calculates profit
  gross_profit?: number;
}

interface TopProduct {
  product_name: string;
  sku: string;
  quantity_sold: number;
  revenue: number;
}

const ReportsDashboard: React.FC = () => {
  // Role & Context
  const userRole = localStorage.getItem('userRole');
  const storedBranchId = localStorage.getItem('branchId');
  const isAdmin = userRole === 'Tenant_Admin' || userRole === 'ADMIN';

  // --- State ---
  const [branches, setBranches] = useState<Branch[]>([]);
  
  // Filters
  const [selectedBranch, setSelectedBranch] = useState<string>(isAdmin ? '' : (storedBranchId || ''));
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Data
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- Fetch Branches (Admin Only) ---
  useEffect(() => {
    if (isAdmin) {
      api.get('/branches').then(res => setBranches(res.data)).catch(console.error);
    }
  }, [isAdmin]);

  // --- Fetch Report Data ---
  useEffect(() => {
    const fetchReports = async () => {
      setIsLoading(true);
      try {
        // Build Query Parameters
        const params = new URLSearchParams();
        if (selectedBranch) params.append('branch_id', selectedBranch);
        
        if (dateRange !== 'custom') {
          params.append('range', dateRange);
        } else if (customStart && customEnd) {
          params.append('start_date', customStart);
          params.append('end_date', customEnd);
        }

        // Fetch Summary Metrics and Top Products concurrently
        const [summaryRes, productsRes] = await Promise.all([
          api.get(`/reports/summary?${params.toString()}`),
          api.get(`/reports/top-products?${params.toString()}`)
        ]);

        setSummary(summaryRes.data);
        setTopProducts(productsRes.data);

      } catch (err) {
        console.error("Failed to fetch reports", err);
      } finally {
        setIsLoading(false);
      }
    };

    // Only fetch custom if dates are provided, otherwise fetch immediately
    if (dateRange !== 'custom' || (customStart && customEnd)) {
        fetchReports();
    }
  }, [selectedBranch, dateRange, customStart, customEnd]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* --- HEADER & FILTERS --- */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-800">Business Reports</h1>
            <p className="text-sm text-gray-500">Analyze sales and performance metrics.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
            {/* Admin Branch Filter */}
            {isAdmin && (
                <select 
                    value={selectedBranch} 
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="border border-gray-300 rounded-lg p-2 text-sm bg-purple-50 focus:ring-purple-500 font-medium"
                >
                    <option value="">All Branches</option>
                    {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
            )}

            {/* Date Range Preset Selector */}
            <div className="flex bg-gray-100 p-1 rounded-lg">
                {(['today', 'week', 'month', 'custom'] as const).map(range => (
                    <button
                        key={range}
                        onClick={() => setDateRange(range)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${
                            dateRange === range ? 'bg-white shadow-sm text-blue-700' : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        {range}
                    </button>
                ))}
            </div>

            {/* Custom Date Pickers */}
            {dateRange === 'custom' && (
                <div className="flex items-center space-x-2 animate-fade-in">
                    <input 
                        type="date" 
                        value={customStart} 
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="border border-gray-300 rounded-lg p-1.5 text-sm"
                    />
                    <span className="text-gray-400">to</span>
                    <input 
                        type="date" 
                        value={customEnd} 
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="border border-gray-300 rounded-lg p-1.5 text-sm"
                    />
                </div>
            )}
        </div>
      </div>

      {isLoading ? (
          <div className="h-64 flex items-center justify-center text-gray-400">Generating Report Data...</div>
      ) : (
          <>
            {/* --- KPI SCORECARDS --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-blue-500">
                    <div className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Total Revenue</div>
                    <div className="text-3xl font-extrabold text-gray-900">
                        ₦{summary?.total_revenue?.toLocaleString() || 0}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-green-500">
                    <div className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Total Sales/Orders</div>
                    <div className="text-3xl font-extrabold text-gray-900">
                        {summary?.total_orders?.toLocaleString() || 0}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-purple-500">
                    <div className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Avg. Order Value</div>
                    <div className="text-3xl font-extrabold text-gray-900">
                        ₦{summary?.average_order_value?.toLocaleString() || 0}
                    </div>
                </div>
            </div>

            {/* --- TOP PRODUCTS TABLE --- */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-5 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-800">Top Selling Products</h3>
                    <span className="text-xs font-bold text-gray-500 uppercase bg-gray-200 px-2 py-1 rounded">By Volume</span>
                </div>
                
                {topProducts.length === 0 ? (
                    <div className="p-10 text-center text-gray-500">No sales data found for the selected period.</div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-white">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty Sold</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Generated Revenue</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {topProducts.map((product, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {product.product_name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                        {product.sku}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600 text-right">
                                        {product.quantity_sold}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                                        ₦{Number(product.revenue).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
          </>
      )}
    </div>
  );
};

export default ReportsDashboard;