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

// FIX 1: Updated to Title Case (Cash, Transfer, POS)
interface PaymentLine {
  method: 'Cash' | 'Transfer' | 'POS'; 
  amount: number;
  reference?: string;
}

const PaymentModal: React.FC<Props> = ({ total, onClose }) => {
  const dispatch = useAppDispatch();
  const cartItems = useAppSelector(state => state.cart.items);

  // --- State ---
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  
  const [payments, setPayments] = useState<PaymentLine[]>([]);
  
  // FIX 2: Updated Default State to 'Cash'
  const [currentMethod, setCurrentMethod] = useState<'Cash' | 'Transfer' | 'POS'>('Cash'); 
  const [currentAmount, setCurrentAmount] = useState<string>('');

  const branchId = localStorage.getItem('branchId');
  
  const [isProcessing, setIsProcessing] = useState(false);

  // --- Calculations ---
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = total - totalPaid;
  const isCreditSale = balance > 0;

  // --- Load Customers ---
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
      const timeoutId = setTimeout(search, 500); 
      return () => clearTimeout(timeoutId);
    }
  }, [customerSearch]);

  // --- Handlers ---
  const addPaymentLine = () => {
    const amount = Number(currentAmount);
    if (!amount || amount <= 0) return;
    
    if (amount > balance && balance > 0) {
        if(!window.confirm(`Amount (₦${amount}) exceeds remaining balance (₦${balance}). Add excess as Change?`)) return;
    }

    setPayments([...payments, { method: currentMethod, amount }]);
    setCurrentAmount(''); 
  };

  const removePaymentLine = (index: number) => {
    const newPayments = [...payments];
    newPayments.splice(index, 1);
    setPayments(newPayments);
  };

  const handleCheckout = async () => {
    if (isCreditSale && !selectedCustomer) {
      alert("⚠️ Credit sales require a registered customer.\nPlease select or create a customer.");
      return;
    }

    if (isCreditSale && selectedCustomer) {
        const newDebt = selectedCustomer.current_debt + balance;
        if (newDebt > selectedCustomer.credit_limit) {
            if (!window.confirm(`⚠️ Credit Limit Warning!\nNew Debt: ₦${newDebt.toLocaleString()}\nLimit: ₦${selectedCustomer.credit_limit.toLocaleString()}\nProceed anyway?`)) {
                return;
            }
        }
    }

    setIsProcessing(true);
    try {
      const payload = {
        customer_id: selectedCustomer?.id || null, 
        total_amount: total,
        amount_paid: totalPaid,
        branch_id: branchId,
        balance: isCreditSale ? balance : 0, 
        status: isCreditSale ? 'PARTIAL' : 'PAID',
        
        // The values here are now 'Cash', 'Transfer', 'POS'
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
        : `Sale Completed! ${balance < 0 ? `\nChange Due: ₦${Math.abs(balance).toLocaleString()}` : ''}`);
        
      dispatch(clearCart());
      onClose();
      
    } catch (err: any) {
      console.error(err);
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
          
          {/* Customer Selection (Unchanged) */}
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

          {/* Payment Builder */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Add Payment</label>
            <div className="flex space-x-2">
                {/* FIX 3: Options updated to Title Case values */}
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
            {balance > 0 && (
                <div className="mt-2 flex gap-2">
                    <button onClick={() => setCurrentAmount(balance.toString())} className="text-xs bg-gray-200 px-2 py-1 rounded hover:bg-gray-300">
                        Full Balance (₦{balance})
                    </button>
                </div>
            )}
          </div>

          {/* Payment List (Unchanged) */}
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

            {/* Totals */}
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

        {/* Footer */}
        <div className="p-6 bg-white border-t border-gray-200 flex space-x-4">
            <button onClick={onClose} className="flex-1 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 text-gray-700">
                Cancel
            </button>
            <button 
                onClick={handleCheckout}
                disabled={isProcessing || (isCreditSale && !selectedCustomer)} 
                className={`flex-1 py-3 rounded-lg font-bold text-white shadow-lg transition-colors ${
                    isCreditSale 
                        ? 'bg-orange-500 hover:bg-orange-600' 
                        : 'bg-green-600 hover:bg-green-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
                {isProcessing ? 'Processing...' : isCreditSale ? 'Confirm Credit Sale' : 'Complete Sale'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;