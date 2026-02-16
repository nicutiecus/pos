import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axiosInstance';
import IncomingTransfers from '../inventory/transfers/IncomingTransfers';

// Simplified interface for stats calculation
interface ProductSummary {
  id: number;
  name: string;
  current_stock: number;
  low_stock_threshold: number; // Assuming your backend provides this
}

const ManagerDashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStockCount: 0,
    totalStockValue: 0 // Optional, if you want to sum price * qty
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch products to generate client-side stats
    // In a real large-scale app, you'd hit a specific /stats endpoint
    const fetchStats = async () => {
      try {
        const res = await api.get<ProductSummary[]>('/inventory/products');
        const products = res.data;
        
        const lowStock = products.filter(p => p.current_stock <= (p.low_stock_threshold || 10)).length;
        
        setStats({
          totalProducts: products.length,
          lowStockCount: lowStock,
          totalStockValue: 0 
        });
      } catch (err) {
        console.error("Failed to load dashboard stats", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <span className="text-sm text-gray-500">Welcome back, Manager</span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Total Inventory */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center space-x-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Products</p>
            <p className="text-2xl font-bold text-gray-900">{isLoading ? '-' : stats.totalProducts}</p>
          </div>
        </div>

        {/* Card 2: Low Stock Alert */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center space-x-4">
          <div className={`p-3 rounded-full ${stats.lowStockCount > 0 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-green-100 text-green-600'}`}>
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Low Stock Alerts</p>
            <p className="text-2xl font-bold text-gray-900">{isLoading ? '-' : stats.lowStockCount}</p>
            <p className="text-xs text-red-500">{stats.lowStockCount > 0 ? 'Action Needed!' : 'Stock Healthy'}</p>
          </div>
        </div>

        {/* Card 3: Quick Action */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 rounded-xl shadow-md text-white flex flex-col justify-center items-start">
          <h3 className="text-lg font-bold mb-2">Incoming Shipment?</h3>
          <p className="text-blue-100 text-sm mb-4">Record new stock batches immediately.</p>
          <Link to="/manager/receive" className="bg-white text-blue-700 px-4 py-2 rounded-md font-semibold hover:bg-gray-100 transition-colors text-sm">
            Go to Receiving →
          </Link>
        </div>
      </div>

      {/* Recent Activity Section (Placeholder) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Operational Status</h3>
        <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p>Recent transaction history will appear here.</p>
        </div>
      </div>

      {/* 2. NEW: Incoming Notifications Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Urgent Actions (Incoming Transfers) */}
        <div className="lg:col-span-2 space-y-6">
           <IncomingTransfers />
        </div>

        {/* Right Column: Quick Links */}
        <div className="space-y-6">
           <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-800 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                 <Link to="/manager/transfer" className="block w-full text-center bg-blue-50 text-blue-700 py-2 rounded border border-blue-100 hover:bg-blue-100 transition">
                    Send Stock to Branch ➔
                 </Link>
                 <Link to="/manager/receive" className="block w-full text-center bg-green-50 text-green-700 py-2 rounded border border-green-100 hover:bg-green-100 transition">
                    Receive Supplier Shipment ➔
                 </Link>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
};

export default ManagerDashboard;