import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axiosInstance';
import { formatBackendDate } from '../../utils/dateFormatter';

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

const AdminDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [branchStats, setBranchStats] = useState<BranchPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const userName = localStorage.getItem('userName')?.split('@')[0] || 'Admin';

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        // Parallel fetching for dashboard widgets
        // NOTE: Adjust these endpoints to match your Django URLs
        const [summaryRes, stockRes, branchRes] = await Promise.all([
          api.get('/reports/summary?range=today'), // Reusing the endpoint from Reports
          api.get('/inventory/low-stock/?limit=5'), // Endpoint to get items below threshold
          api.get('/reports/branch-performance?range=today') // Revenue grouped by branch
        ]);

        setMetrics(summaryRes.data);
        setLowStock(stockRes.data);
        setBranchStats(branchRes.data);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
        // Mock data fallback for UI development if backend endpoints aren't ready
        setMetrics({ total_revenue: 0, total_orders: 0, active_cashiers: 0 });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (isLoading) {
    return <div className="p-10 flex justify-center items-center text-gray-500 h-full">Loading System Overview...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* --- HEADER --- */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight">Welcome back, {userName}</h1>
          <p className="text-sm text-gray-500 mt-1">Here is what is happening across your business today.</p>
        </div>
        <div className="text-right hidden md:block">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Today's Date</p>
          <p className="text-sm font-medium text-gray-700">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      {/* --- KPI SCORECARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4 hover:shadow-md transition-shadow">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-xl text-2xl">💰</div>
          <div>
            <div className="text-sm font-bold text-gray-400 uppercase tracking-wider">Today's Revenue</div>
            <div className="text-3xl font-black text-gray-900">
              ₦{metrics?.total_revenue?.toLocaleString() || 0}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4 hover:shadow-md transition-shadow">
          <div className="p-4 bg-green-50 text-green-600 rounded-xl text-2xl">🛍️</div>
          <div>
            <div className="text-sm font-bold text-gray-400 uppercase tracking-wider">Today's Orders</div>
            <div className="text-3xl font-black text-gray-900">
              {metrics?.total_orders?.toLocaleString() || 0}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4 hover:shadow-md transition-shadow">
          <div className="p-4 bg-purple-50 text-purple-600 rounded-xl text-2xl">👥</div>
          <div>
            <div className="text-sm font-bold text-gray-400 uppercase tracking-wider">Active Cashiers</div>
            <div className="text-3xl font-black text-gray-900">
              {metrics?.active_cashiers || 0}
            </div>
          </div>
        </div>
      </div>

      {/* --- WIDGET GRID --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* WIDGET: Branch Performance */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-bold text-gray-800">Branch Performance (Today)</h3>
            <Link to="/admin/reports" className="text-xs font-bold text-blue-600 hover:underline">View Full Report &rarr;</Link>
          </div>
          <div className="p-5 flex-1 overflow-y-auto">
            {branchStats.length === 0 ? (
              <div className="text-center text-gray-400 py-6 text-sm">No sales recorded today yet.</div>
            ) : (
              <div className="space-y-4">
                {branchStats.map(branch => (
                  <div key={branch.id} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100">
                    <div>
                      <div className="font-bold text-gray-800">{branch.name}</div>
                      <div className="text-xs text-gray-500">{branch.today_orders} orders processed</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">₦{Number(branch.today_revenue).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* WIDGET: Low Stock Alerts */}
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 flex flex-col relative overflow-hidden">
          {/* Subtle warning gradient header */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 to-orange-400"></div>
          
          <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-red-50/30">
            <h3 className="font-bold text-red-800 flex items-center gap-2">
              <span>⚠️</span> Low Stock Alerts
            </h3>
            <Link to="/admin/inventory" className="text-xs font-bold text-red-600 hover:underline">Manage Inventory &rarr;</Link>
          </div>
          
          <div className="p-0 flex-1 overflow-y-auto">
            {lowStock.length === 0 ? (
              <div className="text-center text-gray-400 py-10 text-sm">All branches are sufficiently stocked.</div>
            ) : (
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Left</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-50">
                  {lowStock.map((item, idx) => (
                    <tr key={idx} className="hover:bg-red-50/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="text-sm font-medium text-gray-900">{item.product_name}</div>
                        <div className="text-xs text-gray-400 font-mono">{item.sku}</div>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600">
                        {item.branch_name}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800">
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

      </div>
    </div>
  );
};

export default AdminDashboard;