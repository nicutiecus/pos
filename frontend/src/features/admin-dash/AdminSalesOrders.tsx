import React, { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';

// --- Interfaces ---
export interface SalesOrder {
  id: string | number;
  created_at: string;
  customer_name: string | null;
  cashier_name: string;
  total_amount: number;
  amount_paid: number;
  payment_status: 'PAID' | 'PARTIAL' | 'PENDING';
}

export interface OrderItem {
  id: string | number;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}
export interface Payment {
  method: string;
  amount: string;
  reference_code: string;
  created_at: string;
}

export interface OrderDetail {
  id: string;
  branch_name: string;
  cashier_name: string;
  total_amount: string;
  amount_paid: string;
  discount_amount: string;
  payment_status: string;
  formatted_date: string;
  items: OrderItem[];
  payments: Payment[];
  customer_snapshot: {
    name: string;
    phone: string;
  }
};

const AdminSalesOrders: React.FC = () => {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Search State
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Modal Fetching State
  const [selectedOrderId, setSelectedOrderId] = useState<string | number | null>(null);
  const [orderDetails, setOrderDetails] = useState<OrderDetail | null>(null);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // 1. Debounce Search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // 2. Reset Page on New Search
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);

  // 3. Fetch Order List
  useEffect(() => {
    const fetchOrders = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // NOTE: Adjust this endpoint to match your Django URL for listing sales orders
        const response = await api.get('/sales/list/', {
            params: { page: currentPage, search: debouncedSearchTerm }
        });

        const data = response.data;
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

    fetchOrders();
  }, [currentPage, debouncedSearchTerm]);

  // 4. Fetch Individual Order Details
  useEffect(() => {
    if (!selectedOrderId) {
      setOrderDetails(null);
      return;
    }

    const fetchDetails = async () => {
      setIsModalLoading(true);
      setModalError(null);
      try {
        // NOTE: Adjust this endpoint to match your Django URL for a single order's details
        const response = await api.get(`/sales/${selectedOrderId}/`);
        setOrderDetails(response.data);
      } catch (err: any) {
        console.error("Failed to fetch order details:", err);
        setModalError(err.response?.data?.message || err.response?.data?.detail || "Failed to load order details.");
      } finally {
        setIsModalLoading(false);
      }
    };

    fetchDetails();
  }, [selectedOrderId]);

  // Helper for Status Badges
  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PAID':
        return <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full bg-green-100 text-green-800 border border-green-200">Paid</span>;
      case 'PARTIAL':
        return <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full bg-orange-100 text-orange-800 border border-orange-200">Partial</span>;
      case 'PENDING':
        return <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full bg-red-100 text-red-800 border border-red-200">Credit / Unpaid</span>;
      default:
        return <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full bg-gray-100 text-gray-800 border border-gray-200">{status}</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 relative">
      
      {/* HEADER & FILTERS */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">Sales Orders</h2>
          <p className="text-sm text-gray-500">View all transactions, receipts, and credit sales.</p>
        </div>
        
        <div className="flex w-full md:w-auto">
          <input 
            type="text" 
            placeholder="Search receipt ID, customer, or cashier..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-80 p-3 pl-4 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow font-medium text-sm"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-sm">
          <p className="font-bold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* DATA TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex justify-center items-center h-64 text-gray-500">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
             Loading sales records...
          </div>
        ) : (
          <div className="overflow-x-auto flex-1">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Receipt Info</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Customer & Cashier</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Financials</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400 font-medium">
                      {debouncedSearchTerm ? 'No matching sales found.' : 'No sales orders available.'}
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr 
                      key={order.id} 
                      onClick={() => setSelectedOrderId(order.id)} 
                      className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">#{String(order.id).slice(0, 8).toUpperCase()}</div>
                        <div className="text-xs text-gray-500">{new Date(order.created_at).toLocaleString()}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">{order.customer_name || 'Walk-in Customer'}</div>
                        <div className="text-xs text-gray-500">Served by: {order.cashier_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-black text-gray-900">₦{Number(order.total_amount).toLocaleString()}</div>
                        <div className="text-xs text-gray-500">Paid: ₦{Number(order.amount_paid).toLocaleString()}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {getStatusBadge(order.payment_status)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION FOOTER */}
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
      </div>

      {/* --- DYNAMIC ORDER DETAILS MODAL --- */}
      {selectedOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-lg font-black text-gray-800">Receipt Details</h3>
                <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">Order #{String(selectedOrderId).slice(0, 8)}</p>
              </div>
              <button 
                onClick={() => setSelectedOrderId(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {isModalLoading ? (
                 <div className="flex flex-col items-center justify-center text-gray-500 space-y-3 py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                    <p>Fetching full receipt...</p>
                 </div>
              ) : modalError ? (
                 <div className="bg-red-50 text-red-700 p-4 rounded text-center border border-red-100">
                    <p className="font-bold mb-1">Error Loading Receipt</p>
                    <p className="text-sm">{modalError}</p>
                 </div>
             ) : orderDetails ? (
                 <div className="space-y-6">
                    
                    {/* Header Info */}
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-bold text-gray-900">
                                {orderDetails.customer_snapshot?.name || 'Walk-in Customer'}
                            </p>
                            {orderDetails.customer_snapshot?.phone && (
                                <p className="text-xs text-gray-500">{orderDetails.customer_snapshot.phone}</p>
                            )}
                            <p className="text-xs text-gray-500 mt-2">Branch: {orderDetails.branch_name}</p>
                            <p className="text-xs text-gray-500">Cashier: {orderDetails.cashier_name}</p>
                            <p className="text-xs text-gray-500 mt-1">{orderDetails.formatted_date}</p>
                        </div>
                        <div>
                            {getStatusBadge(orderDetails.payment_status)}
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="border rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase">Item</th>
                                    <th className="px-4 py-2 text-center text-xs font-bold text-gray-500 uppercase">Qty</th>
                                    <th className="px-4 py-2 text-right text-xs font-bold text-gray-500 uppercase">Price</th>
                                    <th className="px-4 py-2 text-right text-xs font-bold text-gray-500 uppercase">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {orderDetails.items && orderDetails.items.length > 0 ? (
                                    orderDetails.items.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="px-4 py-2 text-sm text-gray-900">{item.product_name}</td>
                                            <td className="px-4 py-2 text-sm text-gray-500 text-center">{Number(item.quantity)}</td>
                                            <td className="px-4 py-2 text-sm text-gray-500 text-right">₦{Number(item.unit_price).toLocaleString()}</td>
                                            <td className="px-4 py-2 text-sm font-medium text-gray-900 text-right">₦{Number(item.subtotal).toLocaleString()}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-4 text-center text-sm text-gray-400">No items found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Financial Summary & Payment Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* Payment Breakdown (Left Side) */}
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 border-b pb-2">Payment Breakdown</h4>
                            {orderDetails.payments && orderDetails.payments.length > 0 ? (
                                <div className="space-y-2">
                                    {orderDetails.payments.map((payment, idx) => (
                                        <div key={idx} className="flex justify-between text-sm">
                                            <span className="text-gray-700 font-medium">{payment.method}</span>
                                            <span className="text-gray-900">₦{Number(payment.amount).toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 italic">No payments recorded.</p>
                            )}
                        </div>

                        {/* Totals (Right Side) */}
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-2">
                            {Number(orderDetails.discount_amount) > 0 && (
                                <div className="flex justify-between text-sm text-gray-600">
                                    <span>Discount Applied:</span>
                                    <span className="text-green-600 font-bold">- ₦{Number(orderDetails.discount_amount).toLocaleString()}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-base font-black text-gray-900 pt-2 border-t border-gray-200 border-dashed">
                                <span>Final Total:</span>
                                <span>₦{Number(orderDetails.total_amount).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-600">
                                <span>Total Paid:</span>
                                <span>₦{Number(orderDetails.amount_paid).toLocaleString()}</span>
                            </div>
                            
                            {/* Calculate remaining debt if partial/pending */}
                            {(Number(orderDetails.total_amount) - Number(orderDetails.amount_paid)) > 0 && (
                                <div className="flex justify-between text-sm font-bold text-red-600 pt-2 border-t border-red-200 border-dashed">
                                    <span>Unpaid Balance:</span>
                                    <span>₦{Number(Number(orderDetails.total_amount) - Number(orderDetails.amount_paid)).toLocaleString()}</span>
                                </div>
                            )}
                        </div>
                    </div>

                 </div>
              ) : null}
            </div>

            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 shrink-0">
              <button 
                onClick={() => setSelectedOrderId(null)}
                className="w-full bg-white border border-gray-300 text-gray-700 font-bold py-2.5 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
              >
                Close Receipt
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default AdminSalesOrders;