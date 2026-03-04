import React, { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
//import { useLocation } from 'react-router-dom';
import api from '../../api/axiosInstance';
import { isAxiosError } from 'axios';

// --- Interfaces ---
interface Branch {
  id: number;
  name: string;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  unit_type: string;
}

interface ReceiveLog {
  id: number;
  product_name: string;
  quantity_received: number;
  batch_number: string;
  expiry_date: string;
  created_at: string;
}

interface ReceivePayload {
  branch_id: string; // Dynamic field
  product_id: string;
  quantity_received: number;
  cost_price: string;
  batch_number: string;
  expiry_date: string;
  notes: string;
}

const InventoryReceiving: React.FC = () => {
  const userRole = localStorage.getItem('userRole');
  const storedBranchId = localStorage.getItem('branchId');

  // Is the user an Admin?
  const isAdmin = userRole === 'Tenant_Admin' || userRole === 'ADMIN';

  // Data State
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [recentLogs, setRecentLogs] = useState<ReceiveLog[]>([]);
  
  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Form State
  const [formData, setFormData] = useState<ReceivePayload>({
    branch_id: isAdmin ? '' : (storedBranchId || ''), // Pre-fill if manager, empty if admin
    product_id: '',
    quantity_received: 0,
    cost_price: '',
    batch_number: '',
    expiry_date: '',
    notes: ''
  });

  // --- Load Initial Data ---
  useEffect(() => {
    const loadData = async () => {
      try {
        const promises = [
          api.get('/inventory/products'),
          api.get('/inventory/logs?type=RECEIVE&limit=10')
        ];

        // Only fetch branches if user is Admin
        if (isAdmin) {
          promises.push(api.get('/branches'));
        }

        const [prodRes, logRes, branchRes] = await Promise.all(promises);
        
        setProducts(prodRes.data);
        setRecentLogs(logRes.data);
        if (isAdmin && branchRes) {
          setBranches(branchRes.data);
        }

      } catch (err) {
        console.error("Failed to load receiving data", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [isAdmin]);

  // --- Handlers ---
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };


  // --- HELPER: Date Formatter ---
  const formatDateForBackend = (dateStr: string): string => {
    if (!dateStr) return '';
    
    // Case 1: Already YYYY-MM-DD (e.g. from <input type="date">)
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dateStr;

    // Case 2: DD/MM/YYYY (e.g. from text input)
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            // Convert 25/12/2023 -> 2023-12-25
            const [day, month, year] = parts;
            return `${year}-${month}-${day}`;
        }
    }
    return dateStr; // Fallback
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    // Validation: Ensure branch_id is set
    if (!formData.branch_id) {
       setMessage({ type: 'error', text: "Please select a target branch." });
       setIsSubmitting(false);
       return;
    }

    const backendDate = formatDateForBackend(formData.expiry_date);
    try {
      // Payload matches the nested structure required by backend
      const payload = {
        branch_id: formData.branch_id, 
        items: [
            {
                product_id: Number(formData.product_id),
                quantity: Number(formData.quantity_received),
                cost_price: formData.cost_price,
                batch_number: formData.batch_number,
                expiry_date: backendDate,
                notes: formData.notes
            }
        ]
      };

      await api.post('/inventory/receive/', payload);

      setMessage({ type: 'success', text: 'Stock received successfully!' });
      
      // Optimistic Update
      const newLog: ReceiveLog = {
        id: Date.now(), 
        product_name: products.find(p => p.id === Number(formData.product_id))?.name || 'Unknown',
        quantity_received: Number(formData.quantity_received),
        batch_number: formData.batch_number,
        expiry_date: formData.expiry_date,
        created_at: new Date().toISOString()
      };
      setRecentLogs([newLog, ...recentLogs]);

      // Reset Form (Preserve branch selection for Admin convenience)
      setFormData(prev => ({ 
        ...prev, 
        product_id: '', 
        quantity_received: 0, 
        cost_price: '',
        notes: ''
      }));

    } catch (err) {
      if (isAxiosError(err)) {
        const data = err.response?.data;
        let errorText = 'Failed to record stock.';
        if (data?.items && Array.isArray(data.items)) {
            errorText = `Item Error: ${JSON.stringify(data.items[0])}`;
        } else if (data?.detail) {
            errorText = data.detail;
        } else if (data?.message) {
            errorText = data.message;
        }
        setMessage({ type: 'error', text: errorText });
      } else {
        setMessage({ type: 'error', text: 'An unexpected error occurred.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading Inventory Data...</div>;

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      {/* --- LEFT COLUMN: RECEIVING FORM --- */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center">
                <span className="bg-green-100 text-green-600 p-2 rounded-full mr-3 text-sm">📥</span>
                Record Incoming Stock
            </h2>
            {/* Context Badge */}
            <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                {isAdmin ? 'Admin Mode' : 'Manager Mode'}
            </span>
          </div>
          
          {message && (
            <div className={`mb-6 p-4 rounded text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* ADMIN ONLY: Branch Selection */}
            {isAdmin && (
                <div className="bg-purple-50 p-4 rounded-md border border-purple-100">
                    <label className="block text-sm font-bold text-purple-900 mb-1">Target Branch</label>
                    <select name="branch_id" value={formData.branch_id} onChange={handleChange} required
                        className="w-full rounded-md border-purple-300 shadow-sm p-2 border focus:ring-purple-500 bg-white">
                        <option value="">-- Select Branch to Receive Stock --</option>
                        {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Product Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Product</label>
              <select name="product_id" value={formData.product_id} onChange={handleChange} required
                className="w-full rounded-md border-gray-300 shadow-sm p-3 border focus:ring-blue-500 bg-white text-lg">
                <option value="">-- Choose Item --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} (SKU: {p.sku}) - {p.unit_type}
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity & Cost */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Received</label>
                <input type="number" name="quantity_received" value={formData.quantity_received} onChange={handleChange} required min="1"
                  className="w-full rounded-md border-gray-300 shadow-sm p-3 border focus:ring-blue-500 text-lg font-bold text-blue-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price (Per Unit)</label>
                <div className="relative rounded-md shadow-sm">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <span className="text-gray-500 sm:text-sm">₦</span>
                  </div>
                  <input type="number" name="cost_price" value={formData.cost_price} onChange={handleChange} required placeholder="0.00"
                    className="block w-full rounded-md border-gray-300 pl-7 p-3 border focus:ring-blue-500" />
                </div>
              </div>
            </div>

            {/* Batch & Expiry */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Batch Number</label>
                <input type="text" name="batch_number" value={formData.batch_number} onChange={handleChange} placeholder="e.g. BATCH-001"
                  className="w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 uppercase font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                <input type="date" name="expiry_date" value={formData.expiry_date} onChange={handleChange} required
                  className="w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500" />
              </div>
            </div>

            {/* Notes */}
            <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
               <input type="text" name="notes" value={formData.notes} onChange={handleChange} placeholder="e.g. Delivered by Van 2"
                  className="w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500" />
            </div>

            <div className="flex justify-end pt-2">
              <button type="submit" disabled={isSubmitting}
                className="w-full md:w-auto bg-blue-600 text-white px-8 py-3 rounded-md font-bold hover:bg-blue-700 disabled:opacity-50 shadow-md transition-transform active:scale-95">
                {isSubmitting ? 'Recording...' : 'Confirm Receipt'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* --- RIGHT COLUMN: RECENT ACTIVITY --- */}
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Recent Inputs</h3>
          </div>
          <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
            {recentLogs.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No items received today.</div>
            ) : (
              recentLogs.map((log, idx) => (
                <div key={idx} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-gray-900 text-sm">{log.product_name}</span>
                    <span className="text-green-600 font-bold text-sm">+{log.quantity_received}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span className="font-mono bg-gray-100 px-1 rounded">{log.batch_number || 'NO BATCH'}</span>
                    <span>{log.created_at ? new Date(log.created_at).toLocaleString() : 'N/A'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default InventoryReceiving;