import React, { useEffect, useState, useRef } from 'react';
import api from '../../api/axiosInstance';
import { useReactToPrint } from 'react-to-print';
import { ReceiptTemplate, type ReceiptData } from './ReceiptTemplate';
import { formatBackendDate } from '../../utils/dateFormatter';

// --- Types ---
interface SaleSummary {
  id: string | number;
  receipt_number: string;
  formatted_date: string; 
  total_amount: string;
  payment_method: string; // Now reliably provided by the backend list endpoint!
  branch_name?: string;
  cashier_name?: string;
  customer_name?: string;
  amount_paid?: string;
}

interface SalePayment {
  method: string;
  amount: string | number;
  reference_code?: string;
}

interface SaleItem {
  product_name: string;
  quantity: string | number;
  unit_price: string | number;
  subtotal: string | number; 
}

interface SaleDetail {
  id: string | number;
  branch_name: string;
  cashier_name: string;
  customer_name: string;
  created_at: string;
  total_amount: string;
  amount_paid: string;
  payment_method: string;
  receipt_number: string;
  payments: SalePayment[];
  items: SaleItem[];
  customer_snapshot?: {
    name: string;
    phone: string;
  };
}

const SalesHistory: React.FC = () => {
  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // --- Detailed View State ---
  const [expandedSaleId, setExpandedSaleId] = useState<string | number | null>(null);
  const [expandedSaleData, setExpandedSaleData] = useState<SaleDetail | null>(null);
  const [isLoadingExpanded, setIsLoadingExpanded] = useState(false);

  // --- Printing State ---
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const [printData, setPrintData] = useState<ReceiptData | null>(null);

  const triggerPrint = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: "POS_Receipt",
    onAfterPrint: () => setPrintData(null),
  });

  useEffect(() => {
    fetchSalesList();
  }, []);

  // 1. FETCH SUMMARY (Optimized: 1 Request)
  const fetchSalesList = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('sales/list?limit=50'); 
      const salesData = res.data.results ? res.data.results : (Array.isArray(res.data) ? res.data : []);
      setSales(salesData);
    } catch (err) {
      console.error("Failed to load sales history", err);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. FETCH DETAILS ON DEMAND (Triggered by clicking Receipt #)
  const handleViewOrderDetails = async (saleId: string | number) => {
    // Toggle close if already open
    if (expandedSaleId === saleId) {
        setExpandedSaleId(null);
        setExpandedSaleData(null);
        return;
    }

    setExpandedSaleId(saleId);
    setExpandedSaleData(null);
    setIsLoadingExpanded(true);

    try {
        const res = await api.get(`/sales/${saleId}/`);
        setExpandedSaleData(res.data);
    } catch (err) {
        console.error("Failed to fetch order details", err);
    } finally {
        setIsLoadingExpanded(false);
    }
  };

  // 3. FETCH FOR PRINTING
  const handlePrintRequest = async (summary: SaleSummary) => {
    setIsFetchingDetails(true);
    try {
      const res = await api.get(`/sales/${summary.id}/`);
      const fullSale: SaleDetail = res.data;
      
      const paymentMethods = fullSale.payments && fullSale.payments.length > 0
            ? fullSale.payments.map(p => p.method).join(' + ')
            : fullSale.payment_method || 'Unknown';

      const receiptPayload: ReceiptData = {
        businessName: "GRAMI SOLUTIONS", 
        branchName: fullSale.branch_name || "Main Branch",
        receiptNumber: fullSale.receipt_number || String(fullSale.id).slice(0, 8).toUpperCase(),
        date: fullSale.created_at,
        cashierName: fullSale.cashier_name?.split('@')[0] || "Cashier",
        customerName: fullSale.customer_snapshot?.name || fullSale.customer_name || "Walk-in",
        
        items: (fullSale.items || []).map(item => ({
          product_name: item.product_name,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          total: Number(item.subtotal)
        })),
        
        subtotal: Number(fullSale.total_amount),
        tax: 0,
        total: Number(fullSale.total_amount),
        amountPaid: Number(fullSale.amount_paid || fullSale.total_amount),
        change: Number(fullSale.amount_paid || fullSale.total_amount) - Number(fullSale.total_amount),
        paymentMethod: paymentMethods
      };

      setPrintData(receiptPayload);
      setTimeout(() => triggerPrint(), 100);

    } catch (err) {
      alert("Failed to prepare receipt.");
      console.error(err);
    } finally {
      setIsFetchingDetails(false);
    }
  };

  if (isLoading) return (
      <div className="p-10 text-center flex flex-col items-center justify-center h-64 text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="font-bold">Loading Transactions...</p>
      </div>
  );

  return (
    <div className="bg-white h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <h2 className="font-bold text-gray-800 text-lg">Recent Transactions</h2>
        <button onClick={fetchSalesList} className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1">
          <span>↻</span> Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sales.length === 0 ? (
          <div className="p-10 text-center text-gray-400">No sales recorded today.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Receipt #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Payment Method</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {sales.map((sale) => (
                <React.Fragment key={sale.id}>
                  <tr className={`hover:bg-blue-50 transition-colors ${expandedSaleId === sale.id ? 'bg-blue-50' : ''}`}>
                    
                    <td 
                      onClick={() => handleViewOrderDetails(sale.id)}
                      className="px-4 py-3 whitespace-nowrap text-sm font-bold font-mono text-blue-600 hover:text-blue-800 cursor-pointer underline decoration-blue-200 underline-offset-4"
                      title="Click to view full order details"
                    >
                      {sale.receipt_number || String(sale.id).slice(0,8)}
                    </td>
                    
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {sale.formatted_date ? formatBackendDate(sale.formatted_date, { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        {sale.customer_name || "Walk-in"}
                    </td>
                    
                    {/* Read directly from the updated summary endpoint */}
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full ${
                          sale.payment_method?.toLowerCase().includes('cash') ? 'bg-green-100 text-green-800' :
                          sale.payment_method?.toLowerCase().includes('transfer') ? 'bg-blue-100 text-blue-800' :
                          sale.payment_method?.toLowerCase().includes('pos') ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                      }`}>
                          {sale.payment_method || 'Unknown'}
                      </span>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-bold text-right">
                      ₦{Number(sale.total_amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handlePrintRequest(sale); }}
                        disabled={isFetchingDetails}
                        className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-100 transition-colors"
                        title="Print Receipt"
                      >
                        {isFetchingDetails ? '...' : '🖨️'}
                      </button>
                    </td>
                  </tr>
                  
                  {/* EXPANDED DETAILS ROW (Fetched on Demand) */}
                  {expandedSaleId === sale.id && (
                    <tr className="bg-gray-50 animate-fade-in-down border-b-2 border-blue-100">
                      <td colSpan={6} className="p-4 shadow-inner">
                        
                        {isLoadingExpanded ? (
                             <div className="flex items-center gap-3 text-sm text-blue-600 font-bold animate-pulse">
                                 <div className="h-4 w-4 border-b-2 border-blue-600 rounded-full animate-spin"></div>
                                 Fetching order details...
                             </div>
                        ) : expandedSaleData ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Left: Items */}
                                <div className="bg-white p-3 rounded-lg border border-gray-200">
                                    <h5 className="text-[10px] font-bold text-gray-400 uppercase mb-2">Items Purchased</h5>
                                    {(expandedSaleData.items || []).length > 0 ? (
                                        <ul className="space-y-1 max-h-40 overflow-y-auto pr-2">
                                          {expandedSaleData.items.map((item, idx) => (
                                            <li key={idx} className="flex justify-between text-sm text-gray-800 border-b border-gray-50 pb-1 mb-1">
                                              <span>{Number(item.quantity)}x {item.product_name}</span>
                                              <span className="font-mono font-bold text-gray-600">₦{Number(item.subtotal).toLocaleString()}</span>
                                            </li>
                                          ))}
                                        </ul>
                                    ) : (
                                        <p className="text-sm text-gray-400 italic">No items found.</p>
                                    )}
                                </div>

                                {/* Right: Financials & Payments */}
                                <div className="bg-white p-3 rounded-lg border border-gray-200 space-y-2 text-sm">
                                    <h5 className="text-[10px] font-bold text-gray-400 uppercase mb-2">Payment Breakdown</h5>
                                    
                                    {/* Dynamically list all payment methods from the deep details */}
                                    {(expandedSaleData.payments || []).length > 0 ? (
                                        <div className="space-y-1 mb-3 bg-gray-50 p-2 rounded">
                                            {expandedSaleData.payments.map((payment, idx) => (
                                                <div key={idx} className="flex justify-between">
                                                    <span className="text-gray-600 font-medium">{payment.method}:</span>
                                                    <span className="font-bold text-blue-700">₦{Number(payment.amount).toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex justify-between mb-3 bg-gray-50 p-2 rounded">
                                            <span className="text-gray-600 font-medium">Method:</span>
                                            <span className="font-bold text-blue-700">{expandedSaleData.payment_method}</span>
                                        </div>
                                    )}

                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Processed By:</span> 
                                        <span className="font-bold">{expandedSaleData.cashier_name?.split('@')[0] || 'System'}</span>
                                    </div>
                                    <div className="flex justify-between border-t border-gray-100 pt-2 mt-2">
                                        <span className="text-gray-500 font-bold">Total Amount Paid:</span> 
                                        <span className="font-black text-green-600">₦{Number(expandedSaleData.amount_paid || expandedSaleData.total_amount).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-red-500 italic">Failed to load order details.</div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="absolute -left-[9999px] top-0 opacity-0 -z-50 pointer-events-none">
        <ReceiptTemplate ref={receiptRef} data={printData} />
      </div>

    </div>
  );
};

export default SalesHistory;