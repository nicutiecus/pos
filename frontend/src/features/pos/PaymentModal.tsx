import React, { useState, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { clearCart } from '../../store/slices/cartSlice';
import api from '../../api/axiosInstance';

// --- Types ---
interface Props {
  total: number;
  onClose: () => void;
}

interface Customer {
  id: number;
  name: string;
  phone: string;
  credit_limit: number;
  current_debt: number;
}

interface PaymentLine {
  method: 'Cash' | 'Tansfer' | 'POS';
  amount: number;
  reference?: string; // For Transfer/POS ref
}

const PaymentModal: React.FC<Props> = ({ total, onClose }) => {
  const dispatch = useAppDispatch();
  const cartItems = useAppSelector(state => state.cart.items);

  // --- State ---
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  
  const [payments, setPayments] = useState<PaymentLine[]>([]);
  const [currentMethod, setCurrentMethod] = useState<'Cash' | 'Transfer' | 'POS'>('Cash');
  const [currentAmount, setCurrentAmount] = useState<string>(''); // String for input handling

  const branchId = localStorage.getItem('branchId')
  
  const [isProcessing, setIsProcessing] = useState(false);

  // --- Calculations ---
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = total - totalPaid;
  const isCreditSale = balance > 0;

  // --- Load Customers (Mock or Real) ---
  useEffect(() => {
    if (customerSearch.length > 2) {
      const search = async () => {
        try {
          const res = await api.get(`/customers?search=${customerSearch}`);
          setCustomers(res.data);
        } catch (err) {
            console.error("Customer search failed", err);
        }
      };
      const timeoutId = setTimeout(search, 500); // Debounce
      return () => clearTimeout(timeoutId);
    }
  }, [customerSearch]);

  // --- Handlers ---
  const addPaymentLine = () => {
    const amount = Number(currentAmount);
    if (!amount || amount <= 0) return;
    
    // Prevent overpaying (optional, but good UX)
    if (amount > balance && balance > 0) {
        if(!window.confirm(`Amount (₦${amount}) exceeds balance (₦${balance}). Add as Change/Tip?`)) return;
    }

    setPayments([...payments, { method: currentMethod, amount }]);
    setCurrentAmount(''); // Reset input
    
    // Auto-switch method if needed, or keep focus? 
    // Usually cashiers like to stick to one unless specified.
  };

  const removePaymentLine = (index: number) => {
    const newPayments = [...payments];
    newPayments.splice(index, 1);
    setPayments(newPayments);
  };

  const handleCheckout = async () => {
    // Validation Rule: Credit requires Customer
    if (isCreditSale && !selectedCustomer) {
      alert("⚠️ Credit sales require a registered customer.\nPlease select or create a customer.");
      return;
    }

    if (isCreditSale && selectedCustomer) {
        const newDebt = selectedCustomer.current_debt + balance;
        if (newDebt > selectedCustomer.credit_limit) {
            if (!window.confirm(`⚠️ Credit Limit Warning!\nThis will push customer debt to ₦${newDebt.toLocaleString()}.\nLimit is ₦${selectedCustomer.credit_limit.toLocaleString()}.\nProceed anyway?`)) {
                return;
            }
        }
    }

    setIsProcessing(true);
    try {
      const payload = {
        customer_id: selectedCustomer?.id || null, // Null for walk-in (fully paid)
        total_amount: total,
        amount_paid: totalPaid,
        branch_id: branchId,
        balance: balance, // Backend handles this as debt
        status: isCreditSale ? 'PARTIAL' : 'PAID',
        
        // The Split Payments List
        payments: payments.map(p => ({
            method: p.method,
            amount: p.amount
        })),
        
        items: cartItems.map(item => ({
          product_id: item.id,
          quantity: item.quantity,
          unit_price: item.price
        }))
      };

      await api.post('/sales/create/', payload);

      alert(isCreditSale 
        ? `Sale Recorded!\nCustomer ${selectedCustomer?.name} owes ₦${balance.toLocaleString()}` 
        : 'Sale Completed Successfully!');
        
      dispatch(clearCart());
      onClose();
      
    } catch (err: any) {
      alert(`Transaction Failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-gray-50 p-6 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-gray-700">Checkout</h3>
            <p className="text-sm text-gray-500">{cartItems.length} items</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 uppercase">Total Due</div>
            <div className="text-3xl font-extrabold text-gray-900">₦{total.toLocaleString()}</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* 1. CUSTOMER SELECTION */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Customer (Required for Credit)</label>
            {selectedCustomer ? (
                <div className="flex justify-between items-center bg-blue-50 p-3 rounded border border-blue-200">
                    <div>
                        <div className="font-bold text-blue-900">{selectedCustomer.name}</div>
                        <div className="text-xs text-blue-600">Current Debt: ₦{selectedCustomer.current_debt.toLocaleString()}</div>
                    </div>
                    <button onClick={() => setSelectedCustomer(null)} className="text-red-500 text-xs hover:underline">Change</button>
                </div>
            ) : (
                <div className="relative">
                    <input 
                        type="text" 
                        placeholder="Search Name or Phone..." 
                        className="w-full border rounded p-2 pl-8 focus:ring-2 focus:ring-blue-500"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                    />
                    <span className="absolute left-2.5 top-2.5 text-gray-400">🔍</span>
                    
                    {/* Dropdown Results */}
                    {customers.length > 0 && (
                        <div className="absolute z-10 w-full bg-white border shadow-lg mt-1 rounded max-h-40 overflow-y-auto">
                            {customers.map(c => (
                                <button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomers([]); }}
                                    className="w-full text-left p-2 hover:bg-gray-100 border-b text-sm">
                                    {c.name} ({c.phone})
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
          </div>

          {/* 2. PAYMENT BUILDER */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Add Payment</label>
            <div className="flex space-x-2">
                <select 
                    value={currentMethod} 
                    onChange={(e) => setCurrentMethod(e.target.value as any)}
                    className="border rounded p-2 bg-white flex-1"
                >
                    <option value="Cash">Cash</option>
                    <option value="POS">POS / Card</option>
                    <option value="Transfer">Bank Transfer</option>
                </select>
                <input 
                    type="number" 
                    placeholder="Amount" 
                    value={currentAmount}
                    onChange={(e) => setCurrentAmount(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addPaymentLine()}
                    className="border rounded p-2 w-32"
                />
                <button 
                    onClick={addPaymentLine}
                    disabled={!currentAmount}
                    className="bg-blue-600 text-white px-4 rounded font-bold hover:bg-blue-700 disabled:opacity-50"
                >
                    Add
                </button>
            </div>
            
            {/* Quick Fill Buttons */}
            {balance > 0 && (
                <div className="mt-2 flex gap-2">
                    <button onClick={() => setCurrentAmount(balance.toString())} className="text-xs bg-gray-200 px-2 py-1 rounded hover:bg-gray-300">
                        Full Balance (₦{balance})
                    </button>
                </div>
            )}
          </div>

          {/* 3. PAYMENT LIST & SUMMARY */}
          <div>
            <h4 className="text-sm font-bold text-gray-700 mb-2 border-b pb-1">Payment Breakdown</h4>
            {payments.length === 0 ? (
                <div className="text-gray-400 text-sm italic py-2">No payments added yet.</div>
            ) : (
                <div className="space-y-2">
                    {payments.map((p, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-white p-2 rounded border border-gray-100 shadow-sm">
                            <span className="text-sm font-medium">{p.method}</span>
                            <div className="flex items-center space-x-3">
                                <span className="font-mono font-bold">₦{p.amount.toLocaleString()}</span>
                                <button onClick={() => removePaymentLine(idx)} className="text-red-400 hover:text-red-600">×</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Totals Section */}
            <div className="mt-4 border-t pt-4 space-y-1">
                <div className="flex justify-between text-sm text-gray-600">
                    <span>Total Due:</span>
                    <span>₦{total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-green-700 font-medium">
                    <span>Amount Tendered:</span>
                    <span>- ₦{totalPaid.toLocaleString()}</span>
                </div>
                <div className={`flex justify-between text-lg font-bold border-t border-dashed border-gray-300 pt-2 ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    <span>{balance > 0 ? 'Balance (Credit)' : 'Change Due'}</span>
                    <span>₦{Math.abs(balance).toLocaleString()}</span>
                </div>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-white border-t border-gray-200 flex space-x-4">
            <button onClick={onClose} className="flex-1 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 text-gray-700">
                Cancel
            </button>
            <button 
                onClick={handleCheckout}
                disabled={isProcessing || (balance > 0 && !selectedCustomer) || (balance < 0 && true) /* Optionally block negative balance unless treated as change */} 
                className={`flex-1 py-3 rounded-lg font-bold text-white shadow-lg transition-colors ${
                    balance > 0 
                        ? 'bg-orange-500 hover:bg-orange-600'  // Warning color for Credit
                        : 'bg-green-600 hover:bg-green-700'    // Success color for Paid
                } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
                {isProcessing ? 'Processing...' : balance > 0 ? 'Confirm Credit Sale' : 'Complete Sale'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;