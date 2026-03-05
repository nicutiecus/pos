import React, { useState, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { clearCart } from '../../store/slices/cartSlice';
import api from '../../api/axiosInstance';
// --- IMPORT OFFLINE DB UTILITY ---
import { saveOfflineOrder } from '../../utils/offlineDb';

// --- Types ---
interface Props {
  total: number;
  discountAmount?: number;
  onClose: () => void;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  credit_limit: number;
  current_debt: number;
}

interface PaymentLine {
  method: 'Cash' | 'Transfer' | 'POS'; 
  amount: number;
  reference?: string;
}

const PaymentModal: React.FC<Props> = ({ total, discountAmount, onClose }) => {
  const dispatch = useAppDispatch();
  const cartItems = useAppSelector(state => state.cart.items);

  // --- State ---
  // Customer Search & Selection
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  
  // New Customer Creation State
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', phone: '' });
  
  // Payments
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([{ method: 'Cash', amount: total }]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCreditSale, setIsCreditSale] = useState(false);

  // --- Calculations ---
  const totalPaid = paymentLines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  const balance = total - totalPaid;

  // --- Fetch Customers ---
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const branchId = localStorage.getItem('branchId');
        const res = await api.get(`/sales/customers/?branch_id=${branchId}`);
        setCustomers(res.data);
      } catch (err) {
        console.error("Failed to load customers", err);
      }
    };
    fetchCustomers();
  }, []);

  // --- Handlers ---
  const handleAddPaymentLine = () => {
    if (balance > 0) {
      setPaymentLines([...paymentLines, { method: 'Transfer', amount: balance }]);
    } else {
      setPaymentLines([...paymentLines, { method: 'Transfer', amount: 0 }]);
    }
  };

  const handleRemovePaymentLine = (index: number) => {
    const newLines = paymentLines.filter((_, i) => i !== index);
    setPaymentLines(newLines);
  };

  const handleUpdatePaymentLine = (index: number, field: keyof PaymentLine, value: any) => {
    const newLines = [...paymentLines];
    newLines[index] = { ...newLines[index], [field]: value };
    setPaymentLines(newLines);
  };

  // --- New Customer Handlers ---
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingCustomer(true);
    try {
        const branchId = localStorage.getItem('branchId');
        const payload = {
            ...newCustomerForm,
            branch_id: branchId
        };
        const res = await api.post('/sales/customers/', payload);
        
        const createdCustomer = res.data;
        setCustomers(prev => [...prev, createdCustomer]);
        setSelectedCustomer(createdCustomer);
        setIsCreatingCustomer(false);
        setNewCustomerForm({ name: '', phone: '' });
        
    } catch (err: any) {
        alert(`Failed to create customer: ${err.response?.data?.message || err.message}`);
    } finally {
        setIsSubmittingCustomer(false);
    }
  };

  const handleCheckout = async () => {
    if (balance > 0 && !isCreditSale) {
        alert("Full payment is required unless it is a Credit Sale.");
        return;
    }

    if (isCreditSale && !selectedCustomer) {
        alert("A customer must be selected for a Credit Sale.");
        return;
    }

    if (isCreditSale && selectedCustomer && (selectedCustomer.current_debt + balance > selectedCustomer.credit_limit)) {
        alert(`This credit sale exceeds ${selectedCustomer.name}'s credit limit of ₦${selectedCustomer.credit_limit.toLocaleString()}`);
        return;
    }

    setIsProcessing(true);

    // --- FIX 1 & 2: DEDUCT CHANGE FROM CASH & UPPERCASE METHOD ---
    const changeDue = balance < 0 ? Math.abs(balance) : 0;
    let remainingChangeToDeduct = changeDue;

    const formattedPayments = paymentLines.map(p => {
        let finalAmount = Number(p.amount);

        // We only give physical change out of Cash payments!
        if (p.method === 'Cash' && remainingChangeToDeduct > 0) {
            if (finalAmount >= remainingChangeToDeduct) {
                finalAmount -= remainingChangeToDeduct;
                remainingChangeToDeduct = 0;
            } else {
                remainingChangeToDeduct -= finalAmount;
                finalAmount = 0;
            }
        }

        return {
            method: p.method,
            amount: finalAmount
        };
    }).filter(p => p.amount > 0); // Remove any payment lines that became 0

    const payload = {
        branch_id: localStorage.getItem('branchId'),
        cashier_id: localStorage.getItem('userId'),
        customer_id: selectedCustomer?.id || null,
        total_amount: total,
        discount_amount: discountAmount,
        is_credit: isCreditSale,
        credit_balance: isCreditSale ? balance : 0,
        payments: formattedPayments, // Use the corrected array here
        items: cartItems.map(item => ({
            product_id: item.id, // FIX 3: Changed from item.product_id to fix TS Error
            quantity: item.quantity,
            unit_price: item.price
        }))
    };

    try {
        await api.post('/sales/create/', payload);
        alert('Payment Successful!');
        
        // --- TODO: TRIGGER RECEIPT PRINTING HERE ---
        
        dispatch(clearCart());
        onClose();

    } catch (err: any) {
        // --- OFFLINE FALLBACK INTERCEPTION ---
        if (!navigator.onLine || err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
            console.warn("Network disconnected. Saving order to local IndexedDB...");
            try {
                await saveOfflineOrder(payload);
                alert("You are offline! Order has been saved locally and will sync when the internet returns.");
                dispatch(clearCart());
                onClose();
            } catch (dbErr) {
                console.error("Failed to save offline order:", dbErr);
                alert("Critical Error: Could not save order offline.");
            }
        } else {
            alert(`Checkout failed: ${err.response?.data?.message || err.message}`);
        }
    } finally {
        setIsProcessing(false);
    }
  };
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
    c.phone.includes(customerSearch)
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4 overflow-y-auto">
      <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col my-auto border border-gray-200">
        
        {/* Header */}
        <div className="bg-white p-6 flex justify-between items-center border-b border-gray-200">
          <div>
            <h3 className="font-extrabold text-2xl text-gray-900 tracking-tight">Checkout</h3>
            <p className="text-sm text-gray-500 font-medium">Complete transaction and process payment.</p>
          </div>
          <button onClick={onClose} className="bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full p-2 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        {/* Body Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-0">
          
          {/* LEFT: Customer Selection */}
          <div className="lg:col-span-2 bg-white border-r border-gray-200 p-6 flex flex-col space-y-4">
              <div className="flex justify-between items-center mb-2">
                 <h4 className="font-bold text-gray-700 uppercase tracking-wider text-sm">Customer Info</h4>
                 {selectedCustomer && (
                     <button onClick={() => setSelectedCustomer(null)} className="text-xs text-red-500 hover:text-red-700 font-bold">Clear</button>
                 )}
              </div>

              {selectedCustomer ? (
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
                      <div className="font-bold text-lg text-blue-900">{selectedCustomer.name}</div>
                      <div className="text-sm text-blue-700 mb-3">{selectedCustomer.phone}</div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm bg-white p-3 rounded-lg border border-blue-100">
                          <div>
                              <div className="text-gray-500 text-xs">Current Debt</div>
                              <div className={`font-bold ${selectedCustomer.current_debt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                  ₦{selectedCustomer.current_debt.toLocaleString()}
                              </div>
                          </div>
                          <div>
                              <div className="text-gray-500 text-xs">Credit Limit</div>
                              <div className="font-bold text-gray-800">₦{selectedCustomer.credit_limit.toLocaleString()}</div>
                          </div>
                      </div>
                  </div>
              ) : isCreatingCustomer ? (
                  <form onSubmit={handleCreateCustomer} className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Full Name</label>
                          <input required type="text" value={newCustomerForm.name} onChange={e => setNewCustomerForm({...newCustomerForm, name: e.target.value})} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Phone</label>
                          <input required type="text" value={newCustomerForm.phone} onChange={e => setNewCustomerForm({...newCustomerForm, phone: e.target.value})} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div className="flex gap-2">
                          <button type="button" onClick={() => setIsCreatingCustomer(false)} className="flex-1 py-2 bg-gray-200 text-gray-700 rounded font-bold text-sm">Cancel</button>
                          <button type="submit" disabled={isSubmittingCustomer} className="flex-1 py-2 bg-blue-600 text-white rounded font-bold text-sm disabled:opacity-50">Save</button>
                      </div>
                  </form>
              ) : (
                  <>
                      <input 
                          type="text" 
                          placeholder="Search existing customer..." 
                          value={customerSearch}
                          onChange={e => setCustomerSearch(e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
                      />
                      <div className="flex-1 overflow-y-auto max-h-[300px] border border-gray-100 rounded-lg">
                          {filteredCustomers.map(c => (
                              <button 
                                  key={c.id} 
                                  onClick={() => setSelectedCustomer(c)}
                                  className="w-full text-left p-3 border-b border-gray-100 hover:bg-blue-50 transition-colors flex justify-between items-center"
                              >
                                  <div>
                                      <div className="font-bold text-gray-800">{c.name}</div>
                                      <div className="text-xs text-gray-500">{c.phone}</div>
                                  </div>
                                  <span className="text-blue-600">➔</span>
                              </button>
                          ))}
                      </div>
                      <button 
                          onClick={() => setIsCreatingCustomer(true)}
                          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 font-bold hover:border-blue-500 hover:text-blue-600 transition-colors"
                      >
                          + Add New Customer
                      </button>
                  </>
              )}
          </div>

          {/* RIGHT: Payment Logic */}
          <div className="lg:col-span-3 p-6 flex flex-col">
            <div className="bg-gray-900 text-white p-6 rounded-2xl mb-6 shadow-md flex justify-between items-center">
                <div>
                    <div className="text-gray-400 font-bold text-sm uppercase tracking-widest mb-1">Total Due</div>
                    <div className="text-5xl font-black tracking-tight">₦{total.toLocaleString()}</div>
                </div>
            </div>

            <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-gray-700 uppercase tracking-wider text-sm">Payment Breakdown</h4>
                <label className="flex items-center space-x-2 cursor-pointer bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm hover:bg-gray-50">
                    <input 
                        type="checkbox" 
                        checked={isCreditSale} 
                        onChange={(e) => setIsCreditSale(e.target.checked)}
                        className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm font-bold text-gray-700">Credit Sale</span>
                </label>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto pr-2">
                {paymentLines.map((line, index) => (
                    <div key={index} className="flex gap-3 items-end bg-white p-3 rounded-xl border border-gray-200 shadow-sm relative group">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Method</label>
                            <select 
                                value={line.method} 
                                onChange={e => handleUpdatePaymentLine(index, 'method', e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 font-bold text-gray-700"
                            >
                                <option value="Cash">💵 Cash</option>
                                <option value="Transfer">🏦 Transfer</option>
                                <option value="POS">💳 POS Terminal</option>
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Amount (₦)</label>
                            <input 
                                type="number" 
                                min="0"
                                value={line.amount === 0 ? '' : line.amount} 
                                onChange={e => handleUpdatePaymentLine(index, 'amount', Number(e.target.value))}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 font-black text-gray-900 text-lg"
                                placeholder="0"
                            />
                        </div>
                        {paymentLines.length > 1 && (
                            <button 
                                onClick={() => handleRemovePaymentLine(index)}
                                className="p-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors border border-red-100"
                                title="Remove Payment"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        )}
                    </div>
                ))}

                {!isCreditSale && balance > 0 && (
                    <button 
                        onClick={handleAddPaymentLine}
                        className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 font-bold hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                        + Split Payment
                    </button>
                )}
            </div>

            <div className="mt-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-2">
                <div className="flex justify-between text-gray-500 text-sm font-bold">
                    <span>Total Tendered</span>
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
            <button onClick={onClose} className="flex-1 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 text-gray-700 transition-colors">
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
                {isProcessing ? 'Processing...' : isCreditSale ? 'Confirm Credit Sale' : 'Complete Transaction'}
            </button>
        </div>

      </div>
    </div>
  );
};

export default PaymentModal;