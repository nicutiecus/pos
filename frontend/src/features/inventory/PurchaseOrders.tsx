import React, { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';
import CreatePOModal from './CreatePOModal'; // Adjust import path as needed

interface PurchaseOrder {
  id: string;
  supplier_name: string;
  branch_name: string;
  expected_delivery_date: string | null;
  total_estimated_amount: string;
  status: 'Draft' | 'Sent' | 'Partially Received' | 'Fully Received' | 'Canceled';
  created_at: string;
}

const PurchaseOrders: React.FC = () => {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      // Assuming your DRF backend supports ?search= filtering
      const response = await api.get(`/inventory/purchase-orders/?search=${searchQuery}`);
      setOrders(response.data.results || response.data);
    } catch (err) {
      console.error("Failed to load purchase orders", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch orders on mount and when searchQuery changes (debounced by user typing speed naturally if pressing enter, 
  // but we'll use a simple effect here).
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchOrders();
    }, 500); // 500ms debounce for search

    return () => clearTimeout(delayDebounce);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const handleModalSuccess = () => {
    setIsModalOpen(false);
    fetchOrders(); // Refresh the list to show the newly created PO
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'Sent': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Partially Received': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Fully Received': return 'bg-green-100 text-green-700 border-green-200';
      case 'Canceled': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-200 gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Purchase Orders</h1>
          <p className="text-sm text-gray-500">Manage stock requests and supplier deliveries.</p>
        </div>
        
        <div className="flex w-full md:w-auto gap-3">
          <div className="relative w-full md:w-72">
            <input 
              type="text" 
              placeholder="Search by PO ID or Supplier..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
          </div>
          
          <button 
            onClick={() => setIsModalOpen(true)}
            className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-colors"
          >
            + Create PO
          </button>
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
           <div className="p-12 text-center text-gray-500 font-medium animate-pulse">Loading orders...</div>
        ) : orders.length === 0 ? (
           <div className="p-12 text-center text-gray-500">
             <p className="text-lg font-bold text-gray-400 mb-1">No orders found.</p>
             <p className="text-sm">Try adjusting your search or create a new purchase order.</p>
           </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Order ID</th>
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Supplier</th>
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Branch</th>
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Delivery Date</th>
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Est. Total</th>
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((po) => (
                  <tr key={po.id} className="hover:bg-blue-50/50 transition-colors cursor-pointer">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600">{po.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{po.supplier_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{po.branch_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString() : 'TBD'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-gray-900 text-right">
                        ₦{Number(po.total_estimated_amount).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-3 py-1 inline-flex text-[10px] leading-5 font-bold rounded-full border uppercase tracking-wider ${getStatusColor(po.status)}`}>
                        {po.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MOUNT THE MODAL */}
      <CreatePOModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={handleModalSuccess} 
      />

    </div>
  );
};

export default PurchaseOrders;