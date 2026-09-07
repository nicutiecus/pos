import React, { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';

export interface Customer {
  id: number;
  name: string;
  phone: string;
  credit_limit: number;
  current_debt: number;
  branch_specific_debt: number;
  created_at?: string;
}

interface CustomerEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customer: Customer | null;
  isAdmin: boolean;
}

const CustomerEditModal: React.FC<CustomerEditModalProps> = ({ isOpen, onClose, onSuccess, customer, isAdmin }) => {
  const [formData, setFormData] = useState<Customer | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormData(customer ? { ...customer } : null);
  }, [customer]);

  if (!isOpen || !formData) return null;

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (formData.id) {
        await api.put(`/sales/customers/${formData.id}/`, formData);
      } else {
        await api.post('/sales/customers/', formData);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(`Failed to save customer: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-down">
        <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
          <h3 className="font-bold text-gray-800">{formData.id ? 'Edit Customer' : 'New Customer'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500">&times;</button>
        </div>
        <form onSubmit={handleSaveCustomer} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Full Name</label>
            <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Phone Number</label>
            <input type="tel" required value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })}
              disabled={!isAdmin}
              className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Credit Limit (₦)</label>
            <input type="number" required min="0" value={formData.credit_limit}
              onChange={e => setFormData({ ...formData, credit_limit: Number(e.target.value) })}
              disabled={!isAdmin}
              className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
            {!isAdmin ? (
              <p className="text-xs text-red-500 mt-1 font-bold">Only Tenant Admins can approve or modify credit limits.</p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">Maximum amount this customer is allowed to owe.</p>
            )}
          </div>
          
          <div className="pt-4 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 disabled:opacity-50">
              {isSaving ? 'Saving...' : 'Save Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomerEditModal;