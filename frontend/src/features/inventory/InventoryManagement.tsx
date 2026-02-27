import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axiosInstance';

// --- Types ---
interface InventoryItem {
  id: number;
  product_name: string;
  sku: string;
  category: string;
  total_quantity: number;
  unit_type: string;
  avg_cost_price: number; // Backend usually calculates weighted average
  total_value: number;    // total_quantity * avg_cost_price
  low_stock_threshold: number;
}

interface StockLog {
  id: number;
  created_at: string;
  product_name: string;
  change_type: 'SALE' | 'RECEIVE' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ADJUSTMENT';
  quantity_change: number; // e.g., +50 or -5
  performed_by: string;
  notes?: string;
}

const InventoryManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'STOCK' | 'LOGS'>('STOCK');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [logs, setLogs] = useState<StockLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Dashboard Metrics
  const totalValue = inventory.reduce((sum, item) => sum + Number(item.total_value), 0);
  const lowStockCount = inventory.filter(i => i.total_quantity <= i.low_stock_threshold).length;

  const branchId = localStorage.getItem('branchId');

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'STOCK') {
        const res = await api.get(`inventory/levels/${branchId}`); // Aggregated View
        setInventory(res.data);
      } else {
        const res = await api.get('/inventory/logs?limit=50'); // Audit Trail
        setLogs(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch inventory data", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* --- HEADER & METRICS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="text-sm font-medium text-gray-500">Total Inventory Value</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">₦{totalValue.toLocaleString()}</div>
          <div className="text-xs text-green-600 mt-1">Based on Avg Cost Price</div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="text-sm font-medium text-gray-500">Low Stock Alerts</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{lowStockCount}</div>
          <div className="text-xs text-gray-500 mt-1">Items below threshold</div>
        </div>

        <div className="bg-blue-50 p-6 rounded-lg border border-blue-100 flex flex-col justify-center items-start">
          <h3 className="font-bold text-blue-900 mb-2">Quick Actions</h3>
          <div className="flex space-x-3 text-sm">
            <Link to="/admin/inventory/receive" className="bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
              + Receive Stock
            </Link>
            <Link to="/admin/products" className="bg-white text-blue-700 border border-blue-200 px-3 py-1.5 rounded hover:bg-gray-50">
              Manage Catalog
            </Link>
          </div>
        </div>
      </div>

      {/* --- TABS --- */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('STOCK')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'STOCK' 
                ? 'border-blue-500 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Current Stock Levels
          </button>
          <button
            onClick={() => setActiveTab('LOGS')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'LOGS' 
                ? 'border-blue-500 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Movement History (Logs)
          </button>
        </nav>
      </div>

      {/* --- MAIN CONTENT AREA --- */}
      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        {isLoading ? (
           <div className="p-12 text-center text-gray-500">Loading data...</div>
        ) : activeTab === 'STOCK' ? (
          
          /* STOCK TABLE */
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product Details</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Available Qty</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Asset Value</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {inventory.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{item.product_name}</div>
                    <div className="text-xs text-gray-500 font-mono">SKU: {item.sku}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className={`text-sm font-bold mr-2 ${
                        item.total_quantity <= item.low_stock_threshold ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {item.total_quantity}
                      </span>
                      <span className="text-xs text-gray-500">{item.unit_type}</span>
                      {item.total_quantity <= item.low_stock_threshold && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                          Low
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                    ₦{Number(item.total_value).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

        ) : (

          /* LOGS TABLE */
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date/Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Change</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">User</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      log.change_type === 'SALE' ? 'bg-green-100 text-green-800' :
                      log.change_type === 'RECEIVE' ? 'bg-blue-100 text-blue-800' :
                      log.change_type === 'ADJUSTMENT' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {log.change_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.product_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                    <span className={log.quantity_change > 0 ? 'text-green-600' : 'text-red-600'}>
                      {log.quantity_change > 0 ? '+' : ''}{log.quantity_change}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                    {log.performed_by}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default InventoryManagement;