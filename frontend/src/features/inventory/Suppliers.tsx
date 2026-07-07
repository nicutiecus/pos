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

}

const Suppliers: React.FC = () => {
  // --- State ---
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

  // --- Fetch Data ---
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
                      {/*
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-right">
                        <span className={isNearingLimit ? 'text-red-600' : 'text-gray-900'}>
                          ₦{Number(supplier.current_debt).toLocaleString()}
                        </span>
                        {isNearingLimit && <div className="text-[10px] text-red-500 font-bold uppercase mt-1">Near Limit!</div>}
                      </td>
                      */}
                      <td className="px-6 py-4 whitespace-nowrap text-center space-x-3">
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

    </div>
  );
};

export default Suppliers;