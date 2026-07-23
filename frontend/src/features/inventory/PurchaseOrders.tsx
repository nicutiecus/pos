import React, { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';
import CreatePOModal from './CreatePOModal'; // Adjust import path as needed

// --- Interfaces ---
interface PurchaseOrder {
  id: string;
  supplier_name: string;
  branch_name: string;
  expected_delivery_date: string | null;
  total_estimated_amount: string;
  status: 'Draft' | 'Sent' | 'Partially Received' | 'Fully Received' | 'Canceled';
  created_at: string;
}

// NEW: Interfaces for the detailed view
interface POItemDetail {
  product_id: string;
  product_name: string;
  expected_quantity: string | number;
  agreed_unit_price: string | number;
  subtotal: string | number;
}

interface PurchaseOrderDetail extends PurchaseOrder {
  notes: string;
  ordered_by_name?: string;
  purchase_items: POItemDetail[];
}

interface Branch {
  id: string | number;
  name: string;
}

const PurchaseOrders: React.FC = () => {

  const userRole = localStorage.getItem('userRole')
  const localBranchId = localStorage.getItem('branchId');
  const isAdmin = userRole === 'Tenant_Admin' || userRole === 'ADMIN';
  const [filterBranchId, setFilterBranchId] = useState<string | number>(isAdmin ? '' : (localBranchId || ''));

  const [branches, setBranches] = useState<Branch[]>([])
  
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [error, setError] = useState<string | null>(null)
  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);

  // NEW: Details Modal State
  const [viewingPOId, setViewingPOId] = useState<string | null>(null);
  const [poDetails, setPoDetails] = useState<PurchaseOrderDetail | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);

   // --- Pagination & Search State ---
    const [currentPage, setCurrentPage] = useState(1);
    const [hasNext, setHasNext] = useState(false);
    const [hasPrev, setHasPrev] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');



  // 1. Fetch Branches (Admins Only)
  useEffect(() => {
    if (isAdmin) {
      const fetchBranches = async () => {
        try {
          const res = await api.get('/branches/');
          setBranches(res.data);
        } catch (err) {
          console.error("Failed to fetch branches:", err);
        }
      };
      fetchBranches();
    }
  }, [isAdmin]);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const response = await api.get(`/inventory/purchase-orders/`,{
        params: { 
          page: currentPage, 
          search: searchTerm,
          branch_id: filterBranchId || undefined // Pass branch_id for filtering
      }});

      const data = response.data
      const fetchedOrders = data.results ? data.results : (Array.isArray(data) ? data : []);

      setHasNext(!!data.next);
      setHasPrev(!!data.previous);
      setOrders(fetchedOrders);
    } catch (err: any) {
      console.error("Failed to fetch orders:", err);
      setError(err.response?.data?.message || err.response?.data?.detail || "Failed to load sales orders.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchOrders();
    }, 500); 

    return () => clearTimeout(delayDebounce);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, currentPage, filterBranchId]);

  const handleModalSuccess = () => {
    setIsModalOpen(false);
    fetchOrders(); 
  };
  //  Reset to page 1 ONLY when the search term or branch filter changes
    useEffect(() => {
      setCurrentPage(1);
    }, [searchTerm, filterBranchId]);
  

  // NEW: Fetch PO Details when a row is clicked
  const handleRowClick = async (id: string) => {
    setViewingPOId(id);
    setIsDetailsLoading(true);
    setPoDetails(null); // Reset previous details

    try {
      const response = await api.get(`/inventory/purchase-orders/${id}/`);
      setPoDetails(response.data);
    } catch (err) {
      console.error("Failed to load PO details", err);
    } finally {
      setIsDetailsLoading(false);
    }
  };

  // NEW: Close the details modal
  const closeDetailsModal = () => {
    setViewingPOId(null);
    setPoDetails(null);
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
          {/* Branch Filter (Admins Only) */}
          {isAdmin && (
            <select 
              value={filterBranchId}
              onChange={(e) => setFilterBranchId(e.target.value)}
              className="w-full sm:w-auto p-3 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-gray-50 cursor-pointer"
            >
              <option value="">All Branches</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          )}
          <div className="relative w-full md:w-72">
            <input 
              type="text" 
              placeholder="Search by PO ID or Supplier..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-sm">
          <p className="font-bold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}
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
                  // NEW: Added onClick handler to the row
                  <tr 
                    key={po.id} 
                    onClick={() => handleRowClick(po.id)}
                    className="hover:bg-blue-50/50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600">{"PO-"+po.id}</td>
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

      <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <span className="text-sm text-gray-500 font-medium">
                Page <span className="font-bold text-gray-900">{currentPage}</span>
            </span>
            <div className="flex space-x-2">
                <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={!hasPrev || isLoading}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    Previous
                </button>
                <button
                    onClick={() => setCurrentPage(p => p + 1)}
                    disabled={!hasNext || isLoading}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    Next
                </button>
            </div>
        </div>

      {/* CREATE PO MODAL */}
      <CreatePOModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={handleModalSuccess} 
      />

      {/* NEW: PO DETAILS MODAL */}
      {viewingPOId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
            
            {/* Details Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div>
                <h2 className="text-xl font-black text-gray-900">Purchase Order: {viewingPOId}</h2>
                {poDetails && (
                  <p className="text-sm text-gray-500 mt-1">
                    Created on {new Date(poDetails.created_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              <button 
                onClick={closeDetailsModal}
                className="text-gray-400 hover:text-red-500 transition-colors p-2"
              >
                ✕
              </button>
            </div>

            {/* Details Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {isDetailsLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                  <p className="font-medium animate-pulse">Loading order details...</p>
                </div>
              ) : poDetails ? (
                <div className="space-y-8">
                  
                  {/* Top Metadata Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Supplier</p>
                      <p className="text-sm font-bold text-gray-900">{poDetails.supplier_name}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Destination Branch</p>
                      <p className="text-sm font-medium text-gray-900">{poDetails.branch_name}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Expected Delivery</p>
                      <p className="text-sm font-medium text-gray-900">
                        {poDetails.expected_delivery_date ? new Date(poDetails.expected_delivery_date).toLocaleDateString() : 'TBD'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Status</p>
                      <span className={`px-2.5 py-0.5 inline-flex text-[10px] leading-5 font-bold rounded-full border uppercase tracking-wider ${getStatusColor(poDetails.status)}`}>
                        {poDetails.status}
                      </span>
                    </div>
                  </div>

                  {/* Order Notes */}
                  {poDetails.notes && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-xs font-bold text-yellow-800 uppercase tracking-wider mb-1">Instructions / Notes</p>
                      <p className="text-sm text-yellow-900">{poDetails.notes}</p>
                    </div>
                  )}

                  {/* Line Items Table */}
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3 border-b pb-2">Order Items</h3>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200 text-left">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Product</th>
                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-center">Qty</th>
                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-right">Unit Price</th>
                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {poDetails.purchase_items?.map((item, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.product_name}</td>
                              <td className="px-4 py-3 text-sm text-gray-600 text-center">{item.expected_quantity}</td>
                              <td className="px-4 py-3 text-sm text-gray-600 text-right">₦{Number(item.agreed_unit_price).toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">₦{Number(item.subtotal).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50">
                          <tr>
                            <td colSpan={3} className="px-4 py-3 text-sm font-bold text-gray-600 text-right">Total Estimated Amount:</td>
                            <td className="px-4 py-3 text-sm font-black text-blue-700 text-right">
                              ₦{Number(poDetails.total_estimated_amount).toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="text-center py-12 text-red-500 font-medium">
                  Failed to load details. Please try again.
                </div>
              )}
            </div>

            {/* Details Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button 
                onClick={closeDetailsModal}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2 rounded-lg font-bold transition-colors"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default PurchaseOrders;