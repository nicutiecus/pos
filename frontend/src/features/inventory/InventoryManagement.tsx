import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axiosInstance';

// --- Types ---
interface InventoryItem {
  id: number;
  product_id?: string | number; // Fallback depending on your exact backend mapping
  product_name: string;
  sku: string;
  category: string;
  total_quantity: number;
  unit_type: string;
  avg_cost_price: number;
  total_value: number;
  low_stock_threshold: number;
}



interface InventoryLog {
            id: number;
            date: string;
            product_name: string; 
            branch_name: string, 
            user_name: string, 
            transaction_type: string, 
            reason: string; 
            quantity: number; 
            total_value: number; 
            notes?: string;
}

const InventoryManagement: React.FC = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Dashboard Metrics
  const totalValue = inventory.reduce((sum, item) => sum + Number(item.total_value), 0);
  const lowStockCount = inventory.filter(i => i.total_quantity <= i.low_stock_threshold).length;

  const branchId = localStorage.getItem('branchId');

  const userRole = localStorage.getItem('userRole');
  const basePath = userRole === 'Branch_Manager' ? '/manager' : '/admin';

  useEffect(() => {
    const fetchAllData = async () => {
      setIsLoading(true);
      try {
        // Fetch both stock and logs simultaneously
        const [stockRes, logsRes] = await Promise.all([
          api.get(`/inventory/levels/${branchId}`),
          api.get('/inventory/logs?limit=50')
        ]);
        setInventory(stockRes.data);
        setLogs(logsRes.data);
      } catch (err) {
        console.error("Failed to fetch inventory data", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, [branchId]);

  return (
    <div className="space-y-6 p-4 max-w-[1400px] mx-auto">
      {/* --- HEADER & METRICS --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Inventory Value</div>
          <div className="text-3xl font-black text-gray-900 mt-2">₦{totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <div className="text-xs text-green-600 mt-2 font-medium">Based on Avg Cost Price</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="text-sm font-bold text-gray-500 uppercase tracking-wider">Low Stock Alerts</div>
          <div className="text-3xl font-black text-red-600 mt-2">{lowStockCount}</div>
          <div className="text-xs text-gray-500 mt-2 font-medium">Items below threshold</div>
        </div>

        <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 flex flex-col justify-center items-start shadow-sm">
          <h3 className="font-bold text-blue-900 mb-3 uppercase tracking-wider text-sm">Quick Actions</h3>
          <div className="flex flex-wrap gap-2 text-sm font-bold">
            <Link to={`${basePath}/inventory/receive`} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 shadow-sm transition-colors">
              + Receive
            </Link>
            <Link to={`${basePath}/inventory/remove`} className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-100 shadow-sm transition-colors">
              - Remove
            </Link>
            <Link to={`${basePath}/products`} className="bg-white text-gray-700 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 shadow-sm transition-colors">
              Catalog
            </Link>
          </div>
        </div>
      </div>

      {/* --- MAIN LAYOUT (STOCK LEFT, LOGS RIGHT) --- */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        
        {/* LEFT COLUMN: STOCK TABLE */}
        <div className="flex-1 w-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <h3 className="font-black text-gray-800">Current Stock Levels</h3>
          </div>
          {isLoading ? (
             <div className="p-12 text-center text-gray-500 flex justify-center items-center">
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                 Loading stock...
             </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-white">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Product</th>
                    <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Available</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Value</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {inventory.map((item) => (
                    <tr key={item.id} className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-gray-900">{item.product_name}</div>
                        <div className="text-xs text-gray-400 font-mono mt-0.5">SKU: {item.sku}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className={`text-sm font-black ${item.total_quantity <= item.low_stock_threshold ? 'text-red-600' : 'text-gray-900'}`}>
                            {item.total_quantity}
                          </span>
                          {item.total_quantity <= item.low_stock_threshold && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 uppercase">Low</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-700">
                        ₦{Number(item.total_value).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: LOGS SIDEBAR */}
        <div className="w-full lg:w-[400px] shrink-0 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[600px]">
          <div className="p-4 border-b border-gray-100 bg-gray-50 sticky top-0">
            <h3 className="font-black text-gray-800">Recent Activity</h3>
          </div>
          <div className="overflow-y-auto flex-1 p-4 space-y-4">
            {isLoading ? (
                <div className="text-center text-sm text-gray-400 mt-10">Loading logs...</div>
            ) : logs.length === 0 ? (
                <div className="text-center text-sm text-gray-400 mt-10">No recent stock movements.</div>
            ) : (
                logs.map((log) => (
                  <div key={log.id} className="p-3 border border-gray-100 rounded-lg bg-gray-50 hover:bg-white transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-sm tracking-wider ${
                        log.quantity > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {log.transaction_type}
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium">
                        {new Date(log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-gray-800 mb-1 line-clamp-1">{log.product_name}</div>
                    <div className="flex justify-between items-end">
                      <div className="text-xs text-gray-500 max-w-[70%] line-clamp-1">
                         {log.notes || 'No notes attached.'}
                      </div>
                      <div className={`text-sm font-black ${log.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {log.quantity > 0 ? '+' : ''}{log.quantity}
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default InventoryManagement;