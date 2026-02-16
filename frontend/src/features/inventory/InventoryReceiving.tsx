import React, { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import api from '../../api/axiosInstance';
import { isAxiosError } from 'axios';

interface Product {
  id: number;
  name: string;
  sku: string;
  unit: string;
}

interface StockReceivePayload {
  product_id: string; // ID sent as string from select
  quantity_received: number;
  cost_price: string;
  batch_number: string;
  expiry_date: string;
}

const InventoryReceiving: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState<StockReceivePayload>({
    product_id: '',
    quantity_received: 0,
    cost_price: '',
    batch_number: '',
    expiry_date: ''
  });

  // Load products so user can select WHAT they are receiving
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await api.get('/inventory/products');
        setProducts(res.data);
      } catch (err) {
        console.error("Failed to load products list");
      }
    };
    loadProducts();
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await api.post('/inventory/receive', {
        product_id: Number(formData.product_id), // Ensure it's a number for backend
        quantity_received: Number(formData.quantity_received),
        cost_price: formData.cost_price,
        batch_number: formData.batch_number,
        expiry_date: formData.expiry_date
      });

      setSuccessMsg("Stock Received Successfully!");
      // Reset form but keep the product selected (often you receive multiple batches of same item)
      setFormData(prev => ({ 
        ...prev, 
        quantity_received: 0, 
        batch_number: '', 
        cost_price: '' 
        // We usually leave expiry_date as is, or clear it depending on workflow
      }));

    } catch (err) {
      if (isAxiosError(err)) {
        setErrorMsg(err.response?.data?.message || 'Failed to receive stock.');
      } else {
        setErrorMsg('An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Receive Inventory</h1>
        <p className="text-sm text-gray-500">Record incoming stock (Goods Received Note).</p>
      </div>

      <div className="bg-white p-8 rounded-lg shadow border border-gray-200">
        
        {successMsg && <div className="mb-6 p-4 bg-green-50 text-green-700 rounded border border-green-200 flex items-center">✅ {successMsg}</div>}
        {errorMsg && <div className="mb-6 p-4 bg-red-50 text-red-700 rounded border border-red-200">⚠️ {errorMsg}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Row 1: Product Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Select Product</label>
            <select name="product_id" value={formData.product_id} onChange={handleChange} required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-3 border focus:ring-blue-500 focus:border-blue-500 bg-white">
              <option value="">-- Choose Item --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (SKU: {p.sku}) - {p.unit}
                </option>
              ))}
            </select>
          </div>

          {/* Row 2: Quantity and Cost */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Quantity Received</label>
              <input type="number" name="quantity_received" value={formData.quantity_received} onChange={handleChange} required min="1"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Cost Price (Total or Per Unit?)</label>
              <input type="number" name="cost_price" value={formData.cost_price} onChange={handleChange} required placeholder="0.00"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500" />
              <p className="text-xs text-gray-500 mt-1">Enter cost price per unit.</p>
            </div>
          </div>

          {/* Row 3: Batch and Expiry */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Batch Number</label>
              <input type="text" name="batch_number" value={formData.batch_number} onChange={handleChange} required placeholder="e.g. BATCH-2026-X"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Expiry Date</label>
              <input type="date" name="expiry_date" value={formData.expiry_date} onChange={handleChange} required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <button type="submit" disabled={isSubmitting}
              className="w-full md:w-auto bg-green-600 text-white px-8 py-3 rounded-md font-medium hover:bg-green-700 disabled:opacity-50 shadow-sm transition-colors">
              {isSubmitting ? 'Recording Stock...' : 'Confirm Receipt'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default InventoryReceiving;