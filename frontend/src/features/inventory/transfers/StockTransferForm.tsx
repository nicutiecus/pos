import React, { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import api from '../../../api/axiosInstance';

// --- Interfaces ---
interface Product {
  id: number;
  name: string;
  sku: string;
  current_stock: number;
}

interface Branch {
  id: number;
  name: string;
  location: string;
}

const StockTransferForm: React.FC = () => {
  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  
  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    product_id: '',
    destination_branch_id: '',
    quantity: 0,
    notes: ''
  });

  // --- Load Data ---
  useEffect(() => {
    const loadData = async () => {
      try {
        const [prodRes, branchRes] = await Promise.all([
          api.get('/inventory/products'), // Should return products with current_stock for THIS branch
          api.get('/branches/destinations')  // List of other branches
        ]);
        
        setProducts(prodRes.data);
        // Filter out current branch if backend returns all
        const currentBranchId = Number(localStorage.getItem('branchId'));
        setBranches(branchRes.data.filter((b: Branch) => b.id !== currentBranchId));
        
      } catch (err) {
        console.error("Failed to load transfer data", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // --- Handlers ---
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    // Frontend Validation: Don't send more than you have
    const selectedProduct = products.find(p => p.id === Number(formData.product_id));
    if (selectedProduct && Number(formData.quantity) > selectedProduct.current_stock) {
      setMessage({ type: 'error', text: `Insufficient stock! You only have ${selectedProduct.current_stock} available.` });
      setIsSubmitting(false);
      return;
    }

    try {
      await api.post('/transfers/initiate', {
        product_id: formData.product_id,
        to_branch_id: formData.destination_branch_id,
        quantity: Number(formData.quantity),
        notes: formData.notes
      });

      setMessage({ type: 'success', text: 'Transfer Initiated! Stock moved to "In-Transit".' });
      setFormData({ product_id: '', destination_branch_id: '', quantity: 0, notes: '' });
      
      // Optional: Refresh product list to show deducted stock
      
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Transfer failed.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="p-4 text-center">Loading Inventory...</div>;

  return (
    <div className="max-w-3xl mx-auto bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
        <span className="bg-blue-100 text-blue-600 p-2 rounded-full mr-3 text-sm">✈️</span>
        Initiate Stock Transfer
      </h2>

      {message && (
        <div className={`mb-6 p-4 rounded text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Product Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Product</label>
            <select name="product_id" value={formData.product_id} onChange={handleChange} required
              className="w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 bg-white">
              <option value="">-- Choose Item --</option>
              {products.map(p => (
                <option key={p.id} value={p.id} disabled={p.current_stock <= 0}>
                  {p.name} (Qty: {p.current_stock})
                </option>
              ))}
            </select>
          </div>

          {/* Destination Branch */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Destination Branch</label>
            <select name="destination_branch_id" value={formData.destination_branch_id} onChange={handleChange} required
              className="w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 bg-white">
              <option value="">-- Choose Branch --</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.location})</option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity to Send</label>
            <input type="number" name="quantity" value={formData.quantity} onChange={handleChange} required min="1"
              className="w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500" />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Driver/Transfer Notes</label>
            <input type="text" name="notes" value={formData.notes} onChange={handleChange} placeholder="e.g. Sent via Driver Mike"
              className="w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500" />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-100">
          <button type="submit" disabled={isSubmitting}
            className="bg-blue-600 text-white px-6 py-2 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center">
            {isSubmitting ? 'Processing...' : 'Confirm Transfer'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default StockTransferForm;