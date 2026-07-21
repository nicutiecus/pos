import React, { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import api from '../../api/axiosInstance';
import { isAxiosError } from 'axios';

// --- Interfaces ---
interface Supplier {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  contact_person: string | null;
  current_debt: string | number;
  branch_specific_debt: string;

}


interface Branch{
    id: string | number,
    name: string
}

const Suppliers: React.FC = () => {
  // --- State ---
  const userRole = localStorage.getItem('userRole');
  //const branchId = localStorage.getItem('branchId');
  const isAdmin = userRole === 'Tenant_Admin' || userRole === 'ADMIN' || userRole=== 'Super_Admin';

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editContactPerson, setEditContactPerson] = useState<Supplier | null>(null);
  const [newContact, setNewContact] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Supplier Form State
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    tax_identification_number: ''
  });
  // 3. Debt Repayment
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentSupplier, setPaymentSupplier] = useState<Supplier | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const branchId = localStorage.getItem('branchId');
  const [creditPaymentForm, setCreditPaymentForm] = useState({
        amount: '',
        method: 'Cash',
        notes: 'Credit repayment',
        branch_id: branchId,
    
    });
  const [branches, setBranches] = useState<Branch[]>([])
  const [isLoadingBranches, setIsLoadingBranches] = useState(false)
  // --- Fetch Data ---


  useEffect(() => {
    // Only fetch branches if the user is an Admin and has no assigned branchId
    if (isAdmin && !branchId) {
        const fetchBranches = async () => {
            setIsLoadingBranches(true);
            try {
                // Replace '/api/branches/' with your actual endpoint route
                const res = await api.get('/branches'); 
                
                // Adjust this if your API wraps the array (e.g., res.data.results)
                setBranches(res.data); 
            } catch (error) {
                console.error("Failed to fetch branches:", error);
            } finally {
                setIsLoadingBranches(false);
            }
        };

        fetchBranches();
    }
}, [isAdmin, branchId]);
  const fetchSuppliers = async () => {
    setIsLoading(true);
    try {
      // If you add search filtering to your backend selector, this will pass it!
      const response = await api.get(`/inventory/suppliers/?search=${searchQuery}`);
      setSuppliers(response.data.results || response.data);
    } catch (err) {
      console.error("Failed to load suppliers", err);
      setMessage({ type: 'error', text: 'Failed to load suppliers.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchSuppliers();
    }, 500);
    return () => clearTimeout(delayDebounce);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // --- Handlers ---
  const handleOpenPayment = (supplier: Supplier) => {
      setPaymentSupplier(supplier);
      // Auto-fill the amount with their total debt for convenience
      const relevantDebt =  supplier.current_debt ;
      setCreditPaymentForm({
          amount: relevantDebt.toString(),
          method: 'Cash',
          notes: 'Debt repayment',
          branch_id: branchId,
  
      });
      setIsPaymentModalOpen(true);
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!paymentSupplier)
          return
        if (!creditPaymentForm.branch_id) {
          alert("Error: Branch ID is required to process this payment.");
          return;
      }
  
        setIsProcessingPayment(true);
        try {
            const payload = {
                branch_id: creditPaymentForm.branch_id,
                amount: Number(creditPaymentForm.amount),
                method: creditPaymentForm.method,
                notes: creditPaymentForm.notes,
            };
  
            // NOTE: Adjust this URL to match your exact Django endpoint path
            const res = await api.post(`/inventory/suppliers/${paymentSupplier.id}/accounts-payable/`, payload);
            
            const data = res.data; // The JSON response you provided
  
            alert(`✅ ${data.message}\n\nAmount Paid: ₦${Number(data.amount).toLocaleString()}\nNew Balance: ₦${Number(data.new_balance).toLocaleString()}\nReceipt #: ${data.receipt_no}`);
            
            setIsPaymentModalOpen(false);
            await fetchSuppliers(); // Refresh the list to show new debt balance
            
        } catch (err: any) {
            alert(`Payment failed: ${err.response?.data?.message || err.message}`);
        } finally {
            setIsProcessingPayment(false);
        }
    };

  const handleCreateChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      await api.post('/inventory/suppliers/', formData);
      setMessage({ type: 'success', text: 'Supplier added successfully!' });
      setIsCreateOpen(false);
      setFormData({ name: '', contact_person: '', phone: '', email: '', address: '', tax_identification_number: '' });
      fetchSuppliers();
    } catch (err) {
      if (isAxiosError(err)) {
        setMessage({ type: 'error', text: err.response?.data?.name?.[0] || 'Failed to create supplier.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) return;
    
    try {
      await api.delete(`/inventory/suppliers/${id}/`);
      setMessage({ type: 'success', text: 'Supplier deleted successfully.' });
      fetchSuppliers();
    } catch (err) {
      setMessage({ type: 'error', text: 'Cannot delete supplier. They may have active ledgers or orders.' });
    }
  };


  const handleContactPersonSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editContactPerson) return;
    
    setIsSubmitting(true);
    try {
      await api.patch(`/inventory/suppliers/${editContactPerson.id}/`, {
        contact_person: newContact
      });
      setMessage({ type: 'success', text: 'Contact Person updated.' });
      setEditContactPerson(null);
      fetchSuppliers();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update Contact Person.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-200 gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Suppliers & Accounts Payable</h1>
          <p className="text-sm text-gray-500">Manage vendors, contact details, and credit limits.</p>
        </div>
        
        <div className="flex w-full md:w-auto gap-3">
          <div className="relative w-full md:w-72">
            <input 
              type="text" 
              placeholder="Search suppliers..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
          </div>
          <button 
            onClick={() => setIsCreateOpen(true)}
            className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-colors"
          >
            + Add Supplier
          </button>
        </div>
      </div>

      {/* ALERT MESSAGE */}
      {message && (
        <div className={`p-4 rounded-lg text-sm font-medium animate-fade-in-up ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="float-right font-bold">&times;</button>
        </div>
      )}

      {/* TABLE SECTION */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
           <div className="p-12 text-center text-gray-500 font-medium animate-pulse">Loading suppliers...</div>
        ) : suppliers.length === 0 ? (
           <div className="p-12 text-center text-gray-500">
             <p className="text-lg font-bold text-gray-400 mb-1">No suppliers found.</p>
           </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Company Details</th>
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Contact Person</th>
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Current Debt</th>
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {suppliers.map((supplier) => {
                  {/*const debtRatio = Number(supplier.current_debt) / Number(supplier.debt_limit);
                  const isNearingLimit = debtRatio > 0.8; // 80% used
                  // */}

                  return (
                    <tr key={supplier.id} className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-blue-900 text-sm">{supplier.name}</div>
                        <div className="text-xs text-gray-500">{supplier.phone || 'No phone'} • {supplier.email || 'No email'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {supplier.contact_person || <span className="italic text-gray-400">Not provided</span>}
                         <button 
                          onClick={() => { setEditContactPerson(supplier); setNewContact(supplier.contact_person || ""); }}
                          className="ml-2 text-blue-500 hover:text-blue-700 text-xs" title="Edit Contact Person"
                        >
                           ✏️
                        </button>
                      </td>
                      {/*
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                        ₦{Number(supplier.debt_limit).toLocaleString()}
                        <button 
                          onClick={() => { setEditLimitSupplier(supplier); setNewLimit(supplier.debt_limit.toString()); }}
                          className="ml-2 text-blue-500 hover:text-blue-700 text-xs" title="Edit Limit"
                        >
                           ✏️
                        </button>
                      </td>
                      */}
                      
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-right">
                        <span className={'text-gray-900'}>
                          ₦{Number(supplier.current_debt).toLocaleString()}
                        </span>
                      </td>
                    
                      <td className="px-6 py-4 whitespace-nowrap text-center space-x-3">
                         <button 
                                                onClick={() => handleOpenPayment(supplier)} 
                                                className="text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded shadow-sm transition-colors"
                                            >
                                                💳 Pay
                                            </button>
                        <button onClick={() => handleDelete(supplier.id, supplier.name)} className="text-red-500 hover:text-red-700 text-sm font-medium" title="Remove Supplier">
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- CREATE SUPPLIER MODAL --- */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-black text-gray-800">Add New Supplier</h2>
              <button onClick={() => {setIsCreateOpen(false); setMessage(null);}} className="text-gray-400 hover:text-red-500 font-bold text-xl">&times;</button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">

                {message && message.type === 'error' && (
                <div className="bg-red-50 text-red-700 border border-red-200 p-3 rounded text-sm font-medium">
                  {message.text}
                </div>
              )}
                
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Company Name *</label>
                <input type="text" name="name" value={formData.name} onChange={handleCreateChange} required className="w-full rounded border-gray-300 p-2 border text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Contact Person</label>
                  <input type="text" name="contact_person" value={formData.contact_person} onChange={handleCreateChange} className="w-full rounded border-gray-300 p-2 border text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number</label>
                  <input type="text" name="phone" value={formData.phone} onChange={handleCreateChange} className="w-full rounded border-gray-300 p-2 border text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
                  <input type="email" name="email" value={formData.email} onChange={handleCreateChange} className="w-full rounded border-gray-300 p-2 border text-sm" />
                </div>
                
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Address</label>
                        <input type="text" name="address" value={formData.address} onChange={handleCreateChange} className="w-full rounded border-gray-300 p-2 border text-sm" />
                    </div>
                    <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Tax ID Number (TIN)</label>
                  <input 
                    type="text" 
                    name="tax_identification_number" 
                    value={formData.tax_identification_number} 
                    onChange={handleCreateChange} 
                    placeholder="Optional"
                    className="w-full rounded border-gray-300 p-2 border text-sm" 
                  />
                </div>
                </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-6">
                <button type="button" onClick={() => {setIsCreateOpen(false); setMessage(null);}} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 disabled:opacity-50">
                  {isSubmitting ? 'Saving...' : 'Add Supplier'}
                </button>
              </div> 
            </form>
          </div>
        </div>
      )}

      

       {/* --- EDIT Contact Person MODAL --- */}
      {editContactPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-black text-gray-800">Edit Contact Person</h2>
              <button onClick={() => setEditContactPerson(null)} className="text-gray-400 hover:text-red-500 font-bold text-xl">&times;</button>
            </div>
            <form onSubmit={handleContactPersonSubmit} className="p-6 space-y-4">
                {message && message.type === 'error' && (
                <div className="bg-red-50 text-red-700 border border-red-200 p-3 rounded text-sm font-medium">
                  {message.text}
                </div>
              )}
              <p className="text-sm text-gray-600">Update the Contact Person for <strong>{editContactPerson.name}</strong>.</p>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">New Contact Person</label>
                <input type="text" value={newContact} onChange={(e) => setNewContact(e.target.value)} required className="w-full rounded border-gray-300 p-2 border text-lg font-bold" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button type="button" onClick={() => {setEditContactPerson(null); setMessage(null)}} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 disabled:opacity-50">
                  {isSubmitting ? 'Updating...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Payment Modal */}
      {isPaymentModalOpen && paymentSupplier && (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-down">
                  <div className="bg-green-50 p-5 border-b border-green-100 flex justify-between items-start">
                      <div>
                          <h3 className="font-bold text-lg text-green-900">Process Supplier Payment</h3>
                          <p className="text-sm text-green-700">For {paymentSupplier.name}</p>
                      </div>
                      <button onClick={() => setIsPaymentModalOpen(false)} className="text-green-600 hover:text-red-500 text-xl leading-none">&times;</button>
                  </div>
                  
                  <div className="p-5 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                      <span className="text-sm font-bold text-gray-500 uppercase">{isAdmin? 'Total Owed:' : 'Branch Debt Owed:'}</span>
                      <span className="text-xl font-extrabold text-red-600">₦{Number(paymentSupplier.current_debt).toLocaleString()}</span>
                  </div>

                  <form onSubmit={handleProcessPayment} className="p-5 space-y-4">
                       {(!branchId && isAdmin) && (
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">
                                Branch <span className="text-red-500">*</span>
                            </label>
                            <select 
                                required 
                                value ={creditPaymentForm.branch_id || ''} 
                                onChange={e => setCreditPaymentForm({...creditPaymentForm, branch_id: e.target.value})}
                                className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none bg-blue-50" 
                                disabled={isLoadingBranches}
                            >
                                <option value="" disabled>Select a branch</option>
                                {branches.map(branch => (
                                    <option key={branch.id} value={branch.id}>
                                        {branch.name}
                                    </option>
                                ))}
                            </select>
                            
                            {/* Loading state indicator */}
                            {isLoadingBranches ? (
                                <p className="text-xs text-blue-500 mt-1 animate-pulse">Loading branches...</p>
                            ) : (
                                <p className="text-xs text-gray-500 mt-1">Required for Admins processing payments.</p>
                            )}
                        </div>
                    )}
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Payment Amount (₦)</label>
                          <input 
                              type="number" 
                              required 
                              min="1"
                              max={isAdmin? paymentSupplier.current_debt: paymentSupplier.branch_specific_debt} // Prevent overpaying in this specific modal
                              value={creditPaymentForm.amount} 
                              onChange={e => setCreditPaymentForm({...creditPaymentForm, amount: e.target.value})}
                              className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-lg font-bold text-gray-900" 
                          />
                      </div>
                      
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Payment Method</label>
                          <select 
                              value={creditPaymentForm.method} 
                              onChange={e => setCreditPaymentForm({...creditPaymentForm, method: e.target.value})}
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
                              value={creditPaymentForm.notes} 
                              onChange={e => setCreditPaymentForm({...creditPaymentForm, notes: e.target.value})}
                              className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm" 
                              placeholder="e.g. Paid via GTBank transfer"
                          />
                      </div>
                      
                      <div className="pt-4 flex justify-end space-x-3">
                          <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors">Cancel</button>
                          <button type="submit" disabled={isProcessingPayment || !creditPaymentForm.amount} className="px-5 py-2.5 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 transition-colors shadow-md">
                              {isProcessingPayment ? 'Processing...' : 'Confirm Payment'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
      

    </div>
  );
};

export default Suppliers;