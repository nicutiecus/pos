import React, { useState, useEffect, type FormEvent } from 'react';
import api from '../../api/axiosInstance';
import { isAxiosError } from 'axios';

// --- Interfaces ---
interface PurchaseOrder {
  id: string;
  supplier_name: string;
  branch_name: string;
  branch_id: string;
  expected_delivery_date: string | null;
  status: string;
}

interface ReceiveLog {
  id: number;
  product_name: string;
  quantity_received: number;
  batch_number: string;
  created_at: string;
}

interface ReceiveFormItem {
  product_id: string;
  product_name: string;
  expected_quantity: number;
  quantity_received: number | '';
  cost_price: number | '';
  batch_number: string;
  expiry_date: string;
}

const InventoryReceiving: React.FC = () => {
  const userRole = localStorage.getItem('userRole');
  const isAdmin = userRole === 'Tenant_Admin' || userRole === 'ADMIN';

  // Data State
  const [pendingPOs, setPendingPOs] = useState<PurchaseOrder[]>([]);
  const [recentLogs, setRecentLogs] = useState<ReceiveLog[]>([]);
  
  // Selection State
  const [selectedPOId, setSelectedPOId] = useState<string>('');
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [receiveItems, setReceiveItems] = useState<ReceiveFormItem[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [amountPaidUpfront, setAmountPaidUpfront] = useState<number | ''>('');

  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPO, setIsLoadingPO] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // --- Load Initial Data ---
  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [poRes, logRes] = await Promise.all([
        api.get('/inventory/purchase-orders/?status=Draft'),
        api.get('/inventory/logs?type=RECEIVE&limit=10')
      ]);
      
      setPendingPOs(poRes.data.results || poRes.data);
      setRecentLogs(logRes.data.results || logRes.data);
    } catch (err) {
      console.error("Failed to load initial data", err);
      setMessage({ type: 'error', text: 'Failed to load pending purchase orders.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // --- Fetch Specific PO Details when Selected ---
  useEffect(() => {
    if (!selectedPOId) {
      setSelectedPO(null);
      setReceiveItems([]);
      return;
    }

    const loadPODetails = async () => {
      setIsLoadingPO(true);
      setMessage(null);
      try {
        const response = await api.get(`/inventory/purchase-orders/${selectedPOId}/`);
        const poData = response.data;
        
        setSelectedPO(poData);
        
        // Safety Fallback check for purchase_items from backend
        const itemsList = poData.purchase_items || poData.items || [];
        
        const initialItems: ReceiveFormItem[] = itemsList.map((item: any) => ({
          product_id: item.product_id,
          product_name: item.product_name || `Product ID: ${item.product_id}`,
          expected_quantity: Number(item.expected_quantity || 0),
          quantity_received: Number(item.expected_quantity || 0), 
          cost_price: Number(item.agreed_unit_price || 0), 
          batch_number: '',
          expiry_date: '',
        }));
        
        setReceiveItems(initialItems);
      } catch (err) {
        console.error("Failed to load PO details", err);
        setMessage({ type: 'error', text: 'Failed to load details for this Purchase Order.' });
      } finally {
        setIsLoadingPO(false);
      }
    };

    loadPODetails();
  }, [selectedPOId]);

  // --- Handlers ---
  const handleItemChange = (index: number, field: keyof ReceiveFormItem, value: string) => {
    const updatedItems = [...receiveItems];
    
    // DEBUG FIX: Explicitly handle numbers vs empty string inputs to prevent controlled state bugs
    let sanitizedValue: string | number = value;
    if (field === 'quantity_received' || field === 'cost_price') {
      sanitizedValue = value === '' ? '' : Number(value);
    }

    updatedItems[index] = { ...updatedItems[index], [field]: sanitizedValue };
    setReceiveItems(updatedItems);
  };

  const formatDateForBackend = (dateStr: string): string => {
    if (!dateStr) return '';
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dateStr;
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            const [day, month, year] = parts;
            return `${year}-${month}-${day}`;
        }
    }
    return dateStr;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedPO) return;

    setIsSubmitting(true);
    setMessage(null);

    const itemsToReceive = receiveItems.filter(item => Number(item.quantity_received) > 0);

    if (itemsToReceive.length === 0) {
      setMessage({ type: 'error', text: "Please enter a received quantity greater than 0 for at least one item." });
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = {
        purchase_order_id: selectedPO.id, 
        branch_id: selectedPO.branch_id,  
        amount_paid_upfront: amountPaidUpfront === '' ? 0 : Number(amountPaidUpfront),
        notes: notes,
        items: itemsToReceive.map(item => ({
            product_id: item.product_id,
            quantity: Number(item.quantity_received),
            cost_price: Number(item.cost_price),
            batch_number: item.batch_number.trim(),
            expiry_date: formatDateForBackend(item.expiry_date) || null
        }))
      };

      await api.post('/inventory/receive/', payload);

      setMessage({ type: 'success', text: 'Stock received and linked to Purchase Order successfully!' });
      
      setSelectedPOId('');
      setNotes('');
      setAmountPaidUpfront('');
      loadInitialData();

    } catch (err) {
      if (isAxiosError(err)) {
        const data = err.response?.data;
        setMessage({ type: 'error', text: data?.error || data?.detail || 'Failed to record stock.' });
      } else {
        setMessage({ type: 'error', text: 'An unexpected error occurred.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500 animate-pulse font-medium">Loading Receiving Dashboard...</div>;

  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8 p-4">
      
      <div className="lg:col-span-3 space-y-6">
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-black text-gray-900 flex items-center">
                  <span className="bg-green-100 text-green-600 p-2 rounded-lg mr-3 text-sm">📥</span>
                  Receive Stock (PO)
              </h2>
              <p className="text-sm text-gray-500 mt-1">Receive deliveries against approved Purchase Orders.</p>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                {isAdmin ? 'Admin Mode' : 'Manager Mode'}
            </span>
          </div>
          
          {message && (
            <div className={`mb-6 p-4 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {message.text}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Select Pending Purchase Order</label>
            <select 
              value={selectedPOId} 
              onChange={(e) => setSelectedPOId(e.target.value)}
              className="w-full rounded-lg border-gray-300 shadow-sm p-3 border focus:ring-2 focus:ring-blue-500 bg-gray-50 text-gray-900 font-medium"
            >
              <option value="">-- Choose a Purchase Order --</option>
              {pendingPOs.map(po => (
                <option key={po.id} value={po.id}>
                  PO-{po.id} • {po.supplier_name} • Branch: {po.branch_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoadingPO ? (
          <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-200 text-center text-gray-500 animate-pulse">
            Loading expected items for PO-{selectedPOId}...
          </div>
        ) : selectedPO && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 animate-fade-in-up">
            <div className="flex justify-between items-end mb-4 pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Expected Delivery Items</h3>
                <p className="text-sm text-gray-500">Supplier: <span className="font-bold text-gray-700">{selectedPO.supplier_name}</span></p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Destination</p>
                <p className="font-bold text-blue-900">{selectedPO.branch_name}</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                {receiveItems.map((item, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    
                    <div className="md:col-span-3">
                      <p className="text-sm font-bold text-gray-900">{item.product_name}</p>
                      <p className="text-xs text-gray-500 font-medium mt-1">Expected: <span className="text-blue-600 font-bold">{item.expected_quantity}</span></p>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-500 mb-1">Act. Qty</label>
                      <input 
                        type="number" 
                        value={item.quantity_received} 
                        onChange={(e) => handleItemChange(index, 'quantity_received', e.target.value)} 
                        min="0" 
                        className={`w-full rounded border-gray-300 p-2 text-sm font-bold ${Number(item.quantity_received) < item.expected_quantity ? 'text-yellow-600 bg-yellow-50' : 'text-green-700'}`} 
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-500 mb-1">Unit Cost (₦)</label>
                      <input 
                        type="number" 
                        value={item.cost_price} 
                        onChange={(e) => handleItemChange(index, 'cost_price', e.target.value)} 
                        min="0" step="0.01"
                        className="w-full rounded border-gray-300 p-2 text-sm" 
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-xs font-bold text-gray-500 mb-1">Batch #</label>
                      <input 
                        type="text" 
                        value={item.batch_number} 
                        onChange={(e) => handleItemChange(index, 'batch_number', e.target.value)} 
                        placeholder="e.g. BATCH-001"
                        className="w-full rounded border-gray-300 p-2 text-sm uppercase font-mono" 
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-500 mb-1">Expiry</label>
                      <input 
                        type="date" 
                        value={item.expiry_date} 
                        onChange={(e) => handleItemChange(index, 'expiry_date', e.target.value)} 
                        className="w-full rounded border-gray-300 p-2 text-sm" 
                      />
                    </div>

                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Amount Paid Upfront (₦)</label>
                  <input 
                    type="number" 
                    value={amountPaidUpfront} 
                    onChange={(e) => setAmountPaidUpfront(e.target.value === '' ? '' : Number(e.target.value))} 
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full rounded-lg border-gray-300 shadow-sm p-3 border focus:ring-blue-500 font-bold text-green-700" 
                  />
                  <p className="text-xs text-gray-500 mt-1 font-medium">Leave blank if this is entirely on credit.</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Delivery Notes / Waybill Ref</label>
                  <input 
                    type="text" 
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)} 
                    placeholder="e.g. Delivered by Van 2, Waybill #12345"
                    className="w-full rounded-lg border-gray-300 shadow-sm p-3 border focus:ring-blue-500" 
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full md:w-auto bg-blue-600 text-white px-8 py-3 rounded-lg font-black tracking-wide hover:bg-blue-700 disabled:opacity-50 shadow-md transition-transform active:scale-95"
                >
                  {isSubmitting ? 'Processing Receipt...' : 'Confirm Stock Receipt'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden sticky top-6">
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <h3 className="font-bold text-gray-700 text-xs uppercase tracking-wider">Recent Receipts</h3>
          </div>
          <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
            {recentLogs.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No recent deliveries.</div>
            ) : (
              recentLogs.map((log, idx) => (
                <div key={idx} className="p-4 hover:bg-blue-50/50 transition-colors">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-gray-900 text-sm truncate pr-2">{log.product_name}</span>
                    <span className="text-green-600 font-black text-sm shrink-0">+{log.quantity_received}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-500 mt-2">
                    <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">{log.batch_number || 'NO BATCH'}</span>
                    <span>{log.created_at ? new Date(log.created_at).toLocaleDateString() : 'N/A'}</span>
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