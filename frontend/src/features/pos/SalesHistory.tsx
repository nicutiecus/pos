import React, { useEffect, useState, useRef } from 'react';
import api from '../../api/axiosInstance';
import { useReactToPrint } from 'react-to-print';
import { ReceiptTemplate, type ReceiptData } from './ReceiptTemplate';

// --- Types ---

// 1. Summary: Lightweight data for the list
interface SaleSummary {
  id: string; // Changed to string to match UUIDs usually
  receipt_number: string;
  created_at: string; // or formatted_date
  total_amount: string;
  payment_method: string; // or payment_status
  // Items might be missing in summary, so we make it optional
  items?: Array<{
    product_name: string;
    quantity: number;
    total: number;
  }>;
  // Fields for receipt mapping
  branch_name?: string;
  cashier_name?: string;
  customer_name?: string;
  amount_paid?: string;
}

// 2. Detail: Full data for the receipt (fetched on demand)
interface SaleDetail {
  id: string;
  branch_name: string;
  cashier_name: string;
  customer_name: string;
  created_at: string;
  total_amount: string;
  amount_paid: string;
  payment_status: string;
  payment_method: string;
  receipt_number: string;
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
}

const SalesHistory: React.FC = () => {
  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);

  // --- Printing State ---
  const receiptRef = useRef<HTMLDivElement>(null);
  const [printData, setPrintData] = useState<ReceiptData | null>(null);

  const triggerPrint = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: "POS_Receipt",
    onAfterPrint: () => setPrintData(null),
  });

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    try {
      // Fetch sales summary list
      const res = await api.get('sales/list?limit=50'); 
      setSales(res.data);
    } catch (err) {
      console.error("Failed to load sales history", err);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Logic: Fetch Full Details -> Print ---
  const handlePrintRequest = async (summary: SaleSummary) => {
    setIsFetchingDetails(true);
    try {
      // 1. Fetch Full Details (Items are needed for receipt)
      const res = await api.get(`/sales/${summary.id}/`);
      const fullSale: SaleDetail = res.data;

      // 2. Map to Receipt Format
      const receiptPayload: ReceiptData = {
        businessName: "EQUEST COLDROOM", 
        branchName: fullSale.branch_name || "Main Branch",
        receiptNumber: fullSale.receipt_number || fullSale.id.slice(0, 8).toUpperCase(),
        date: fullSale.created_at,
        cashierName: fullSale.cashier_name?.split('@')[0] || "Cashier",
        customerName: fullSale.customer_name || "Walk-in",
        
        items: fullSale.items.map(item => ({
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: Number(item.unit_price),
          total: Number(item.total)
        })),
        
        subtotal: Number(fullSale.total_amount),
        tax: 0,
        total: Number(fullSale.total_amount),
        amountPaid: Number(fullSale.amount_paid),
        change: Number(fullSale.amount_paid) - Number(fullSale.total_amount),
        paymentMethod: fullSale.payment_method || fullSale.payment_status
      };

      setPrintData(receiptPayload);
      
      // 3. Trigger Print (Small delay for render)
      setTimeout(() => triggerPrint(), 100);

    } catch (err) {
      alert("Failed to load receipt details.");
      console.error(err);
    } finally {
      setIsFetchingDetails(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading Sales Records...</div>;

  return (
    <div className="bg-white h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <h2 className="font-bold text-gray-800 text-lg">Recent Transactions</h2>
        <button onClick={fetchSales} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
          ↻ Refresh
        </button>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-y-auto">
        {sales.length === 0 ? (
          <div className="p-10 text-center text-gray-400">No sales recorded today.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Receipt #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {sales.map((sale) => (
                <React.Fragment key={sale.id}>
                  <tr 
                    onClick={() => setExpandedSaleId(expandedSaleId === sale.id ? null : sale.id)}
                    className={`cursor-pointer hover:bg-blue-50 transition-colors ${expandedSaleId === sale.id ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-600">
                      {sale.receipt_number || sale.id.slice(0,8)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${
                        sale.payment_method === 'Cash' ? 'bg-green-100 text-green-700 border-green-200' :
                        sale.payment_method === 'POS' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                        'bg-purple-100 text-purple-700 border-purple-200'
                      }`}>
                        {sale.payment_method}
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
                  
                  {/* EXPANDED DETAILS - Safe rendering if items missing */}
                  {expandedSaleId === sale.id && (
                    <tr className="bg-gray-50 animate-fade-in-down">
                      <td colSpan={5} className="p-4 border-b border-gray-100 shadow-inner">
                        <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Items Purchased</div>
                        {sale.items && sale.items.length > 0 ? (
                            <ul className="space-y-1">
                              {sale.items.map((item, idx) => (
                                <li key={idx} className="flex justify-between text-sm text-gray-700">
                                  <span>{item.quantity}x {item.product_name}</span>
                                  <span className="font-mono text-gray-500">₦{Number(item.total).toLocaleString()}</span>
                                  {/* Handle simple summary items which might not have total calculated */}
                                </li>
                              ))}
                            </ul>
                        ) : (
                            <div className="text-xs text-gray-400 italic">
                                details hidden in summary view. Click print for full receipt.
                            </div>
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

      {/* Hidden Receipt Component - REQUIRED for printing */}
      <div style={{ display: 'none' }}>
        <ReceiptTemplate ref={receiptRef} data={printData} />
      </div>

    </div>
  );
};

export default SalesHistory;