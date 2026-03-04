import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/axiosInstance';
import { useReactToPrint } from 'react-to-print';
import { ReceiptTemplate, type ReceiptData } from './ReceiptTemplate';

interface Props {
  onClose: () => void;
}

interface Customer {
  id: number;
  name: string;
  phone: string;
  current_debt: number;
}

const DebtRepaymentModal: React.FC<Props> = ({ onClose }) => {
  const branchId = localStorage.getItem('branchId');
  const cashierName = localStorage.getItem('userName')?.split('@')[0] || 'Cashier';

  // --- State ---
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [notes] = useState('Debt Repayment');
  
  const [isProcessing, setIsProcessing] = useState(false);

  // --- Printing State ---
  const receiptRef = useRef<HTMLDivElement>(null);
  const [printData, setPrintData] = useState<ReceiptData | null>(null);

  const triggerPrint = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: "Repayment_Receipt",
    onAfterPrint: () => {
        setPrintData(null);
        onClose(); // Close the modal only AFTER printing is done
    },
  });

  // --- Search Customers ---
  useEffect(() => {
    if (customerSearch.length > 2) {
      const search = async () => {
        try {
          const res = await api.get(`/sales/customers?search=${customerSearch}`);
          // Only show customers who actually owe money
          const debtors = res.data.filter((c: Customer) => c.current_debt > 0);
          setCustomers(debtors);
        } catch (err) {
            console.error("Customer search failed", err);
        }
      };
      const timeoutId = setTimeout(search, 500); 
      return () => clearTimeout(timeoutId);
    } else {
        setCustomers([]);
    }
  }, [customerSearch]);

  // --- Process Payment ---
  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !branchId || !amount) return;

    setIsProcessing(true);
    try {
      const payload = {
        branch_id: branchId,
        amount: Number(amount),
        method: method,
        notes: notes
      };

      // Hit your backend endpoint
      const res = await api.post(`/sales/customers/${selectedCustomer.id}/pay-debt/`, payload);
      const data = res.data; // This matches the JSON response you provided

      // Format the data to reuse our standard ReceiptTemplate
      const receiptPayload: ReceiptData = {
        businessName: "EQUEST COLDROOM", 
        branchName: localStorage.getItem('branchName') || "Main Branch",
        receiptNumber: data.invoice_number,
        date: data.date,
        cashierName: cashierName,
        customerName: data.customer_name,
        
        // We treat the debt repayment as a single "product" to trick the receipt template
        items: [{
          product_name: 'Payment on Account (Debt Clearance)',
          quantity: 1,
          unit_price: Number(data.amount_paid),
          total: Number(data.amount_paid)
        }],
        
        subtotal: Number(data.amount_paid),
        tax: 0,
        total: Number(data.amount_paid),
        amountPaid: Number(data.amount_paid),
        change: 0, // No change calculated here
        paymentMethod: method
      };

      setPrintData(receiptPayload);
      
      // Wait a tiny bit for React to render the hidden receipt, then print
      setTimeout(() => triggerPrint(), 150);
      
    } catch (err: any) {
      alert(`Payment failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col min-h-[450px]">
        
        <div className="bg-green-50 p-5 border-b border-green-100 flex justify-between items-center">
          <h3 className="text-lg font-bold text-green-900">Process Debt Repayment</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 text-xl leading-none">&times;</button>
        </div>

        <div className="p-6 space-y-6">
          {/* 1. Select Customer */}
          {!selectedCustomer ? (
              <div>
                  <label className="text-sm font-bold text-gray-700 block mb-2">Search Debtor</label>
                  <div className="relative">
                      <input 
                          type="text" 
                          placeholder="Search Name or Phone..." 
                          className="w-full border rounded-lg p-3 pl-10 focus:ring-2 focus:ring-green-500 outline-none bg-gray-50"
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          autoFocus
                      />
                      <span className="absolute left-3 top-3 text-gray-400">🔍</span>
                      
                      {customers.length > 0 && (
                          <div className="absolute z-10 w-full bg-white border shadow-xl mt-2 rounded-lg max-h-48 overflow-y-auto">
                              {customers.map(c => (
                                  <button key={c.id} onClick={() => { setSelectedCustomer(c); setAmount(c.current_debt.toString()); }}
                                      className="w-full text-left p-3 hover:bg-green-50 border-b flex justify-between items-center">
                                      <div>
                                          <span className="font-bold text-gray-800 block">{c.name}</span> 
                                          <span className="text-xs text-gray-500">{c.phone}</span>
                                      </div>
                                      <div className="text-red-600 font-bold text-sm">Owes ₦{Number(c.current_debt).toLocaleString()}</div>
                                  </button>
                              ))}
                          </div>
                      )}
                  </div>
              </div>
          ) : (
              // 2. Process Payment Form
              <form onSubmit={handleProcessPayment} className="space-y-4 animate-fade-in">
                  <div className="flex justify-between items-center bg-green-50 p-4 rounded-lg border border-green-200">
                      <div>
                          <div className="font-bold text-green-900">{selectedCustomer.name}</div>
                          <div className="text-xs text-gray-500">Total Debt: <span className="text-red-600 font-bold">₦{Number(selectedCustomer.current_debt).toLocaleString()}</span></div>
                      </div>
                      <button type="button" onClick={() => setSelectedCustomer(null)} className="text-red-500 text-xs hover:underline font-medium">Change</button>
                  </div>

                  <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Amount to Pay (₦)</label>
                      <input 
                          type="number" 
                          required 
                          min="1"
                          max={selectedCustomer.current_debt} // Prevent overpaying
                          value={amount} 
                          onChange={e => setAmount(e.target.value)}
                          className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-xl font-bold text-gray-900" 
                      />
                  </div>
                  
                  <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Payment Method</label>
                      <select 
                          value={method} 
                          onChange={e => setMethod(e.target.value)}
                          className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                      >
                          <option value="Cash">Cash</option>
                          <option value="Transfer">Bank Transfer</option>
                          <option value="POS">POS / Card</option>
                      </select>
                  </div>

                  <button 
                      type="submit" 
                      disabled={isProcessing || !amount} 
                      className="w-full mt-4 bg-green-600 text-white p-4 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 transition-colors shadow-lg flex justify-center items-center"
                  >
                      {isProcessing ? 'Processing...' : `Pay ₦${Number(amount || 0).toLocaleString()} & Print Receipt`}
                  </button>
              </form>
          )}
        </div>
      </div>

      {/* Hidden Receipt Component */}
      <div style={{ display: 'none' }}>
        <ReceiptTemplate ref={receiptRef} data={printData} />
      </div>

    </div>
  );
};

export default DebtRepaymentModal;