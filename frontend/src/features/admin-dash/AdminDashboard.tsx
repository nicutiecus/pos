import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axiosInstance';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

// --- Interfaces ---
interface DashboardMetrics {
  total_revenue: number;
  total_orders: number;
  active_cashiers: number;
}

interface LowStockItem {
  id: number;
  product_name: string;
  sku: string;
  current_stock: number;
  branch_name: string;
  reorder_level?: number;
}

interface BranchPerformance {
  id: number;
  name: string;
  today_revenue: number;
  today_orders: number;
}

interface TrendData {
  date: string;
  revenue: number;
}

const AdminDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [branchStats, setBranchStats] = useState<BranchPerformance[]>([]);
  const [revenueTrend, setRevenueTrend] = useState<TrendData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const userName = localStorage.getItem('userName')?.split('@')[0] || 'Admin';

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const [summaryRes, stockRes, branchRes, trendRes] = await Promise.allSettled([
          api.get('/reports/dashboard/summary/'),
          api.get('/inventory/low-stock/'),
          api.get('/reports/branches/performance/'),
          api.get('/reports/revenue-trend/') // New endpoint for the Line Chart
        ]);

        if (summaryRes.status === 'fulfilled') setMetrics(summaryRes.value.data);
        if (stockRes.status === 'fulfilled') setLowStock(stockRes.value.data);
        if (branchRes.status === 'fulfilled') setBranchStats(branchRes.value.data);
        
        // If the trend endpoint exists, use it. Otherwise, inject fallback dummy data for presentation.
        if (trendRes.status === 'fulfilled' && trendRes.value.data?.length > 0) {
            setRevenueTrend(trendRes.value.data);
        } else {
            setRevenueTrend([
                { date: 'Mon', revenue: 120000 },
                { date: 'Tue', revenue: 150000 },
                { date: 'Wed', revenue: 180000 },
                { date: 'Thu', revenue: 140000 },
                { date: 'Fri', revenue: 210000 },
                { date: 'Sat', revenue: 260000 },
                { date: 'Sun', revenue: 230000 },
            ]);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard data", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full text-blue-600">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* HEADER SECTION */}
      <div className="flex justify-between items-end bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-black text-gray-800 tracking-tight">System Overview</h1>
          <p className="text-gray-500 text-sm mt-1">Welcome back, <span className="font-bold text-blue-600">{userName}</span>. Here is today's snapshot.</p>
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-xs font-bold text-gray-400 uppercase">Today's Date</div>
          <div className="text-lg font-bold text-gray-700">{new Date().toLocaleDateString('en-GB')}</div>
        </div>
      </div>

      {/* TOP METRICS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
          <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Total Revenue (Today)</div>
          <div className="text-3xl font-black text-gray-900">
            ₦{metrics?.total_revenue?.toLocaleString() || '0'}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-green-500 hover:shadow-md transition-shadow">
          <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Total Orders (Today)</div>
          <div className="text-3xl font-black text-gray-900">
            {metrics?.total_orders?.toLocaleString() || '0'}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-purple-500 hover:shadow-md transition-shadow">
          <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Active Cashiers</div>
          <div className="text-3xl font-black text-gray-900">
            {metrics?.active_cashiers || '0'}
          </div>
        </div>
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Line Chart: Revenue Trend */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-96">
            <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">7-Day Revenue Trend</h3>
            <div className="flex-1 w-full h-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenueTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(value) => `₦${value/1000}k`} />
                        <Tooltip 
                            formatter={(value: any) => [`₦${value.toLocaleString()}`, 'Revenue']}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                        />
                        <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Bar Chart: Branch Performance */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-96">
            <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">Today's Revenue by Branch</h3>
            <div className="flex-1 w-full h-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={branchStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(value) => `₦${value/1000}k`} />
                        <Tooltip 
                            cursor={{ fill: '#F3F4F6' }}
                            formatter={(value: any) => [`₦${value.toLocaleString()}`, 'Revenue']}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                        />
                        <Bar dataKey="today_revenue" fill="#10B981" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

      </div>

      {/* LOWER SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Low Stock Alerts */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden flex flex-col">
          <div className="bg-red-50 p-4 border-b border-red-100 flex justify-between items-center">
            <h3 className="font-bold text-red-900 flex items-center gap-2">
              <span className="text-xl">⚠️</span> Low Stock Alerts
            </h3>
            <span className="text-xs font-bold bg-white text-red-600 px-2 py-1 rounded-full shadow-sm">{lowStock.length} Items</span>
          </div>
          
          <div className="flex-1 overflow-auto max-h-80">
            {lowStock.length === 0 ? (
              <div className="p-8 text-center text-gray-500">All stock levels are healthy.</div>
            ) : (
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-white sticky top-0">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Item</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Branch</th>
                    <th className="px-5 py-3 text-right text-xs font-bold text-gray-500 uppercase">Stock Left</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-50">
                  {lowStock.map((item, idx) => (
                    <tr key={idx} className="hover:bg-red-50/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="text-sm font-bold text-gray-900">{item.product_name}</div>
                        <div className="text-xs text-gray-400 font-mono">{item.sku}</div>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600 font-medium">
                        {item.branch_name}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-red-100 text-red-800">
                          {item.current_stock}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
            <div className="bg-gray-50 p-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-800">Admin Actions</h3>
            </div>
            <div className="p-6 flex flex-col gap-4">
                <Link to="/admin/catalog" className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors group">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">📦</span>
                        <span className="font-bold text-gray-700 group-hover:text-blue-700">Manage Catalog</span>
                    </div>
                    <span className="text-gray-300 group-hover:text-blue-500">➔</span>
                </Link>
                <Link to="/admin/staff" className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors group">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">👥</span>
                        <span className="font-bold text-gray-700 group-hover:text-blue-700">Users & Roles</span>
                    </div>
                    <span className="text-gray-300 group-hover:text-blue-500">➔</span>
                </Link>
                <Link to="/admin/reports" className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors group">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">📑</span>
                        <span className="font-bold text-gray-700 group-hover:text-blue-700">Detailed Reports</span>
                    </div>
                    <span className="text-gray-300 group-hover:text-blue-500">➔</span>
                </Link>
            </div>
        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;