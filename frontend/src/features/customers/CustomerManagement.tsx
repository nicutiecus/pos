import React, { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';
import { formatBackendDate } from '../../utils/dateFormatter';

// --- Interfaces ---
interface Customer {
  id: number;
  name: string;
  phone: string;
  credit_limit: number;
  current_debt: number;
  created_at?: string;
}

interface LedgerEntry {
  id: string;
  created_at: string;
  type: 'SALE' | 'PAYMENT' | 'REFUND';
  amount: string;
  balance_after: string;
  reference: string;
}

const CustomerManagement: React.FC = () => {
  // --- Global State ---
  const userRole = localStorage.getItem('userRole');
  const branchId = localStorage.getItem('branchId');
  const isAdmin = userRole === 'Tenant_Admin' || userRole === 'ADMIN';

  // --- Data State ---
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // --- Filter State ---
  const [searchTerm, setSearchTerm] = useState('');
  const [showDebtorsOnly, setShowDebtorsOnly] = useState(false);

  // --- Modal States ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [activeLedgerCustomer, setActiveLedgerCustomer] = useState<Customer | null>(null);
  const [ledgerData, setLedgerData] = useState<LedgerEntry[]>([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);

  // 3. Debt Repayment (NEW)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
      amount: '',
      method: 'Cash',
      notes: 'Debt repayment'
  });

  // --- Fetch Data ---
  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/sales/customers/');
      setCustomers(res.data);
    } catch (err) {
      console.error("Failed to fetch customers", err);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Handlers ---
  const handleEditClick = (customer: Customer) => {
    setEditingCustomer({ ...customer });
    setIsEditModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;

    setIsSaving(true);
    try {
      if (editingCustomer.id) {
        // Update existing
        await api.put(`/sales/customers/${editingCustomer.id}/`, editingCustomer);
      } else {
        // Create new (if you want this page to also add customers)
        await api.post('/sales/customers/', editingCustomer);
      }
      
      await fetchCustomers(); // Refresh list
      setIsEditModalOpen(false);
      setEditingCustomer(null);
    } catch (err: any) {
      alert(`Failed to save customer: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewLedger = async (customer: Customer) => {
    setActiveLedgerCustomer(customer);
    setIsLedgerOpen(true);
    setIsLoadingLedger(true);
    
    try {
      // Typically an endpoint like /customers/{id}/ledger/ or filtering sales
      const res = await api.get(`/sales/customers/${customer.id}/ledger/`);
      setLedgerData(res.data);
    } catch (err) {
      console.error("Failed to fetch ledger", err);
      // Fallback empty state if endpoint isn't ready
      setLedgerData([]); 
    } finally {
      setIsLoadingLedger(false);
    }
  };

  // --- NEW: Payment Handlers ---
  const handleOpenPayment = (customer: Customer) => {
      setPaymentCustomer(customer);
      // Auto-fill the amount with their total debt for convenience
      setPaymentForm({
          amount: customer.current_debt.toString(),
          method: 'Cash',
          notes: 'Debt repayment'
      });
      setIsPaymentModalOpen(true);
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!paymentCustomer || !branchId) return;

      setIsProcessingPayment(true);
      try {
          const payload = {
              branch_id: branchId,
              amount: Number(paymentForm.amount),
              method: paymentForm.method,
              notes: paymentForm.notes
          };

          // NOTE: Adjust this URL to match your exact Django endpoint path
          const res = await api.post(`/sales/customers/${paymentCustomer.id}/pay-debt/`, payload);
          
          const data = res.data; // The JSON response you provided

          alert(`✅ ${data.message}\n\nAmount Paid: ₦${Number(data.amount_paid).toLocaleString()}\nNew Balance: ₦${Number(data.new_balance).toLocaleString()}\nReceipt #: ${data.invoice_number}`);
          
          setIsPaymentModalOpen(false);
          await fetchCustomers(); // Refresh the list to show new debt balance
          
      } catch (err: any) {
          alert(`Payment failed: ${err.response?.data?.message || err.message}`);
      } finally {
          setIsProcessingPayment(false);
      }
  };

  // --- Derived Data ---
  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm);
    const matchesDebt = showDebtorsOnly ? c.current_debt > 0 : true;
    return matchesSearch && matchesDebt;
  });

  const totalOutstandingDebt = customers.reduce((sum, c) => sum + Number(c.current_debt), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* HEADER & METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-center">
            <h1 className="text-2xl font-bold text-gray-800">Customer Management</h1>
            <p className="text-sm text-gray-500">View customer details, update credit limits, and track debts.</p>
        </div>
        <div className="bg-red-50 p-6 rounded-xl shadow-sm border border-red-100 flex flex-col justify-center items-center text-center">
            <div className="text-sm font-bold text-red-600 uppercase tracking-wider mb-1">Total Outstanding Debt</div>
            <div className="text-3xl font-extrabold text-red-700">₦{totalOutstandingDebt.toLocaleString()}</div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between gap-4">
        <div className="flex-1 relative">
            <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
            <input 
                type="text" 
                placeholder="Search by Name or Phone..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
        </div>
        <div className="flex items-center gap-4">
            <label className="flex items-center space-x-2 cursor-pointer bg-gray-50 px-3 py-2 rounded-lg border hover:bg-gray-100 transition-colors">
                <input 
                    type="checkbox" 
                    checked={showDebtorsOnly}
                    onChange={(e) => setShowDebtorsOnly(e.target.checked)}
                    className="rounded text-red-500 focus:ring-red-500 w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-700">Show Debtors Only</span>
            </label>
            <button 
                onClick={() => { setEditingCustomer({ id: 0, name: '', phone: '', credit_limit: 0, current_debt: 0 }); setIsEditModalOpen(true); }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm"
            >
                + New Customer
            </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
            <div className="p-12 text-center text-gray-500">Loading Customers...</div>
        ) : (
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credit Limit</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Current Debt</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {filteredCustomers.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-gray-400">No customers found.</td></tr>
                        ) : (
                            filteredCustomers.map(customer => (
                                <tr key={customer.id} className="hover:bg-blue-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{customer.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{customer.phone}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">₦{Number(customer.credit_limit).toLocaleString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <span className={`font-bold ${customer.current_debt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            ₦{Number(customer.current_debt).toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-3">
                                        
                                        {customer.current_debt > 0 && (
                                            <button 
                                                onClick={() => handleOpenPayment(customer)} 
                                                className="text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded shadow-sm transition-colors"
                                            >
                                                💳 Pay
                                            </button>
                                        )}
                                        <button onClick={() => handleViewLedger(customer)} className="text-blue-600 hover:text-blue-900 bg-blue-50 px-2 py-1 rounded">
                                            📓 Ledger
                                        </button>
                                        <button onClick={() => handleEditClick(customer)} className="text-gray-600 hover:text-gray-900 bg-gray-100 px-2 py-1 rounded">
                                            ✏️ Edit
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        )}
      </div>

      {/* --- REPAYMENT MODAL (NEW) --- */}
      {isPaymentModalOpen && paymentCustomer && (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-down">
                  <div className="bg-green-50 p-5 border-b border-green-100 flex justify-between items-start">
                      <div>
                          <h3 className="font-bold text-lg text-green-900">Process Repayment</h3>
                          <p className="text-sm text-green-700">For {paymentCustomer.name}</p>
                      </div>
                      <button onClick={() => setIsPaymentModalOpen(false)} className="text-green-600 hover:text-red-500 text-xl leading-none">&times;</button>
                  </div>
                  
                  <div className="p-5 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                      <span className="text-sm font-bold text-gray-500 uppercase">Total Owed:</span>
                      <span className="text-xl font-extrabold text-red-600">₦{Number(paymentCustomer.current_debt).toLocaleString()}</span>
                  </div>

                  <form onSubmit={handleProcessPayment} className="p-5 space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Payment Amount (₦)</label>
                          <input 
                              type="number" 
                              required 
                              min="1"
                              max={paymentCustomer.current_debt} // Prevent overpaying in this specific modal
                              value={paymentForm.amount} 
                              onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})}
                              className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-lg font-bold text-gray-900" 
                          />
                      </div>
                      
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Payment Method</label>
                          <select 
                              value={paymentForm.method} 
                              onChange={e => setPaymentForm({...paymentForm, method: e.target.value})}
                              className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                          >
                              <option value="Cash">Cash</option>
                              <option value="Transfer">Bank Transfer</option>
                              <option value="POS">POS / Card</option>
                          </select>
                      </div>

                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Notes (Optional)</label>
                          <input 
                              type="text" 
                              value={paymentForm.notes} 
                              onChange={e => setPaymentForm({...paymentForm, notes: e.target.value})}
                              className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm" 
                              placeholder="e.g. Paid via GTBank transfer"
                          />
                      </div>
                      
                      <div className="pt-4 flex justify-end space-x-3">
                          <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors">Cancel</button>
                          <button type="submit" disabled={isProcessingPayment || !paymentForm.amount} className="px-5 py-2.5 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 transition-colors shadow-md">
                              {isProcessingPayment ? 'Processing...' : 'Confirm Payment'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* --- EDIT MODAL --- */}
      {isEditModalOpen && editingCustomer && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-down">
                  <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
                      <h3 className="font-bold text-gray-800">{editingCustomer.id ? 'Edit Customer' : 'New Customer'}</h3>
                      <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-red-500">&times;</button>
                  </div>
                  <form onSubmit={handleSaveCustomer} className="p-6 space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Full Name</label>
                          <input type="text" required value={editingCustomer.name} onChange={e => setEditingCustomer({...editingCustomer, name: e.target.value})}
                              className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Phone Number</label>
                          <input type="tel" required value={editingCustomer.phone} onChange={e => setEditingCustomer({...editingCustomer, phone: e.target.value})}
                              className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Credit Limit (₦)</label>
                          <input type="number" required min="0" value={editingCustomer.credit_limit} 
                              onChange={e => setEditingCustomer({...editingCustomer, credit_limit: Number(e.target.value)})}
                              // Optional: Disable credit limit editing for non-admins if desired
                              disabled={!isAdmin && false} 
                              className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
                          <p className="text-xs text-gray-500 mt-1">Maximum amount this customer is allowed to owe.</p>
                      </div>
                      
                      <div className="pt-4 flex justify-end space-x-3">
                          <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50">Cancel</button>
                          <button type="submit" disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 disabled:opacity-50">
                              {isSaving ? 'Saving...' : 'Save Customer'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* --- LEDGER MODAL --- */}
      {isLedgerOpen && activeLedgerCustomer && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in">
                  <div className="bg-gray-50 p-4 border-b flex justify-between items-start">
                      <div>
                          <h3 className="font-bold text-lg text-gray-800">Ledger: {activeLedgerCustomer.name}</h3>
                          <p className="text-sm text-gray-500 font-mono">{activeLedgerCustomer.phone}</p>
                      </div>
                      <div className="text-right">
                          <div className="text-xs font-bold text-gray-500 uppercase">Current Debt</div>
                          <div className={`text-xl font-bold ${activeLedgerCustomer.current_debt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              ₦{Number(activeLedgerCustomer.current_debt).toLocaleString()}
                          </div>
                      </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4">
                      {isLoadingLedger ? (
                          <div className="text-center text-gray-400 py-10">Loading Ledger History...</div>
                      ) : ledgerData.length === 0 ? (
                          <div className="text-center text-gray-400 py-10 italic">No ledger history found for this customer.</div>
                      ) : (
                          <div className="space-y-3">
                              {ledgerData.map((entry, idx) => (
                                  <div key={idx} className="flex justify-between items-center p-3 border rounded-lg bg-white shadow-sm">
                                      <div>
                                          <div className="text-xs text-gray-400">{formatBackendDate(entry.created_at)}</div>
                                          <div className="font-bold text-sm text-gray-700">
                                              {entry.type === 'SALE' ? '🛍️ Credit Purchase' : entry.type === 'PAYMENT' ? '💰 Debt Repayment' : 'Refund'}
                                              <span className="ml-2 font-mono text-xs text-gray-400">Ref: {entry.reference}</span>
                                          </div>
                                      </div>
                                      <div className="text-right">
                                          <div className={`font-bold ${entry.type === 'PAYMENT' ? 'text-red-600' : 'text-green-600'}`}>
                                              {entry.type === 'PAYMENT' ? '+' : '-'} ₦{Number(entry.amount).toLocaleString()}
                                          </div>
                                          <div className="text-xs text-gray-500">Balance: ₦{Number(entry.balance_after).toLocaleString()}</div>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
                  
                  <div className="p-4 bg-gray-50 border-t flex justify-end">
                      <button onClick={() => setIsLedgerOpen(false)} className="px-6 py-2 bg-gray-800 text-white rounded font-bold hover:bg-gray-900">
                          Close
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default CustomerManagement;