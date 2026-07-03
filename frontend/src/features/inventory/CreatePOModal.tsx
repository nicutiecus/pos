import React, { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import api from '../../api/axiosInstance';
import { isAxiosError } from 'axios';

interface Branch { id: string; name: string; }
interface Supplier { id: string; name: string; }
interface Product { id: string; name: string; sku: string; unit_type: string; }

interface POItem {
  product_id: string;
  expected_quantity: number | '';
  agreed_unit_price: number | '';
}

interface CreatePOModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreatePOModal: React.FC<CreatePOModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const userRole = localStorage.getItem('userRole');
  const storedBranchId = localStorage.getItem('branchId');
  const isAdmin = userRole === 'Tenant_Admin' || userRole === 'ADMIN';

  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'error', text: string } | null>(null);

  const [formData, setFormData] = useState({
    branch_id: isAdmin ? '' : (storedBranchId || ''),
    supplier_id: '',
    expected_delivery_date: '',
    notes: ''
  });

  const [items, setItems] = useState<POItem[]>([
    { product_id: '', expected_quantity: '', agreed_unit_price: '' }
  ]);

  useEffect(() => {
    if (!isOpen) return; // Only fetch data when modal opens
    const loadData = async () => {
      try {
        const promises = [
          api.get('/inventory/products/'),
          api.get('/inventory/suppliers/')
        ];
        if (isAdmin) promises.push(api.get('/branches/'));

        const [prodRes, suppRes, branchRes] = await Promise.all(promises);
        setProducts(prodRes.data);
        setSuppliers(suppRes.data.results || suppRes.data);
        if (isAdmin && branchRes) setBranches(branchRes.data.results || branchRes.data);
      } catch (err) {
        console.error("Failed to load form data", err);
      }
    };
    loadData();
  }, [isOpen, isAdmin]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleItemChange = (index: number, field: keyof POItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const resetForm = () => {
    setFormData(prev => ({ ...prev, expected_delivery_date: '', notes: '' }));
    setItems([{ product_id: '', expected_quantity: '', agreed_unit_price: '' }]);
    setMessage(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    if (!formData.branch_id) {
       setMessage({ type: 'error', text: "Please select a target branch." });
       setIsSubmitting(false); return;
    }
    if (items.some(item => !item.product_id || !item.expected_quantity || !item.agreed_unit_price)) {
        setMessage({ type: 'error', text: "Please complete all fields for the requested products." });
        setIsSubmitting(false); return;
    }

    try {
      const payload = {
        ...formData,
        expected_delivery_date: formData.expected_delivery_date || null,
        purchase_items: items.map(item => ({
            product_id: item.product_id,
            expected_quantity: Number(item.expected_quantity),
            agreed_unit_price: Number(item.agreed_unit_price)
        }))
      };

      await api.post('/inventory/purchase-orders/create', payload);
      resetForm();
      onSuccess(); // Triggers the parent to refresh the list and close the modal
    } catch (err) {
      if (isAxiosError(err)) {
        const data = err.response?.data;
        setMessage({ type: 'error', text: data?.error || data?.detail || 'Failed to create PO.' });
      } else {
        setMessage({ type: 'error', text: 'An unexpected error occurred.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-fade-in-up">
        
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10">
          <h2 className="text-xl font-black text-gray-800">Create Purchase Order</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 font-bold text-xl">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {message && (
            <div className="p-4 rounded text-sm bg-red-50 text-red-700 border border-red-200">
              {message.text}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {isAdmin && (
                <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Target Branch</label>
                    <select name="branch_id" value={formData.branch_id} onChange={handleChange} required className="w-full rounded border-gray-300 p-2 border bg-gray-50 text-sm">
                        <option value="">-- Select Branch --</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>
            )}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Supplier</label>
              <select name="supplier_id" value={formData.supplier_id} onChange={handleChange} required className="w-full rounded border-gray-300 p-2 border bg-gray-50 text-sm">
                <option value="">-- Select Supplier --</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Expected Delivery</label>
              <input type="date" name="expected_delivery_date" value={formData.expected_delivery_date} onChange={handleChange} className="w-full rounded border-gray-300 p-2 border bg-gray-50 text-sm" />
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
              <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-bold text-gray-800">Products</h3>
                  <button type="button" onClick={() => setItems([...items, { product_id: '', expected_quantity: '', agreed_unit_price: '' }])} className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded">
                      + Add Item
                  </button>
              </div>

              <div className="space-y-3">
                  {items.map((item, index) => (
                      <div key={index} className="flex flex-col md:flex-row gap-3 items-end">
                          <div className="flex-1">
                              <select value={item.product_id} onChange={(e) => handleItemChange(index, 'product_id', e.target.value)} required className="w-full rounded border-gray-300 p-2 border text-sm">
                                  <option value="">-- Select Product --</option>
                                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                          </div>
                          <div className="w-full md:w-32">
                              <input type="number" value={item.expected_quantity} onChange={(e) => handleItemChange(index, 'expected_quantity', e.target.value)} required min="1" className="w-full rounded border-gray-300 p-2 border text-sm" placeholder="Qty" />
                          </div>
                          <div className="w-full md:w-40">
                              <input type="number" value={item.agreed_unit_price} onChange={(e) => handleItemChange(index, 'agreed_unit_price', e.target.value)} required min="0" step="0.01" className="w-full rounded border-gray-300 p-2 border text-sm" placeholder="Unit Price (₦)" />
                          </div>
                          <button type="button" onClick={() => setItems(items.filter((_, i) => i !== index))} disabled={items.length === 1} className="p-2 text-red-500 hover:bg-red-50 rounded disabled:opacity-30">
                              🗑️
                          </button>
                      </div>
                  ))}
              </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
             <label className="block text-xs font-bold text-gray-700 mb-1">Notes</label>
             <textarea name="notes" value={formData.notes} onChange={handleChange} rows={2} className="w-full rounded border-gray-300 p-2 border text-sm" />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 disabled:opacity-50">
              {isSubmitting ? 'Saving...' : 'Create Order'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default CreatePOModal;