import React, { useState, useEffect } from 'react';
import api from '../../api/axiosInstance'; 

interface ReturnGoodsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Branch {
  id: string | number;
  name: string;
}

interface ReturnItem {
  itemId: string;
  quantity: number;
  condition: string;
}

export const ReturnGoodsModal: React.FC<ReturnGoodsModalProps> = ({ isOpen, onClose }) => {
  // --- Auth & Role State ---
  const userRole = localStorage.getItem('userRole');
  const branchId = localStorage.getItem('branchId');
  const isAdmin = userRole === 'Tenant_Admin' || userRole === 'ADMIN';

  // --- Branch Fetching State ---
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  

  // --- Dynamic Form State ---
  const [receiptId, setReceiptId] = useState('');
  const [branchIdState, setBranchIdState] = useState<string | number>(branchId || '');
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  
  // The items array
  const [items, setItems] = useState<ReturnItem[]>([
    { itemId: '', quantity: 1, condition: 'restockable' }
  ]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Fetch Branches for Admins ---
  useEffect(() => {
    if (isAdmin && !branchId && isOpen) {
        const fetchBranches = async () => {
            setIsLoadingBranches(true);
            try {
                const res = await api.get('/branches/'); 
                setBranches(res.data); 
            } catch (error) {
                console.error("Failed to fetch branches:", error);
            } finally {
                setIsLoadingBranches(false);
            }
        };
        fetchBranches();
    }
  }, [isAdmin, branchId, isOpen]);

  // --- Item Array Handlers ---
  const handleItemChange = (index: number, field: keyof ReturnItem, value: string | number) => {
    setItems(prev => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], [field]: value };
      return newItems;
    });
  };

  const addItem = () => {
    setItems(prev => [...prev, { itemId: '', quantity: 1, condition: 'restockable' }]);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // --- Submission ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!branchIdState) {
        alert("Error: Branch is required to process this return.");
        return;
    }

    if (items.length === 0) {
        alert("Error: You must add at least one item to return.");
        return;
    }

    setIsSubmitting(true);
    
    try {
      const payload = {
          original_order_id: receiptId, 
          reason: notes,                
          branch_id: branchIdState,         
          items: items.map(item => ({
              product_name: item.itemId,
              quantity: item.quantity,
              condition: item.condition,
              refund_amount: refundAmount, 
          }))
      };

      await api.post('/returns/process-returns/', payload);
      
      alert(`✅ Return processed successfully!\nReceipt: ${receiptId}\nRefunded: ₦${refundAmount.toLocaleString()}`);
      
      // Reset form
      setReceiptId('');
      setNotes('');
      setRefundAmount(0);
      setItems([{ itemId: '', quantity: 1, condition: 'RESTOCKABLE' }]);
      if (!isAdmin) setBranchIdState(branchId || ''); 
      onClose();

    } catch (error: any) {
      console.error("Failed to process return:", error);
      alert(`❌ Failed to process return: ${error.response?.data?.error || error.response?.data?.message || error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      {/* Increased max-width and added flex-col to handle scrolling gracefully */}
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-down">
        
        {/* Modal Header */}
        <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center shrink-0">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <span>↩️</span> Process Returned Goods
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors text-2xl leading-none">&times;</button>
        </div>

        {/* Modal Body / Form - Scrollable Area */}
        <div className="p-6 overflow-y-auto flex-1">
          <form id="return-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Top Section: Branch & Receipt */}
            <div className="space-y-4">
              {(!branchId && isAdmin) && ( 
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                        Branch Processing Return <span className="text-red-500">*</span>
                    </label>
                    <select 
                        required 
                        value={branchIdState} 
                        onChange={e => setBranchIdState(e.target.value)}
                        className="w-full border border-blue-200 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white" 
                        disabled={isLoadingBranches}
                    >
                        <option value="" disabled>Select a branch</option>
                        {branches.map(branch => (
                            <option key={branch.id} value={branch.id}>{branch.name}</option>
                        ))}
                    </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Receipt ID <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  required 
                  value={receiptId} 
                  onChange={e => setReceiptId(e.target.value)} 
                  className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 font-medium tracking-wide" 
                  placeholder="e.g. REC-10293" 
                />
              </div>
            </div>

            {/* Middle Section: Dynamic Items Array */}
            <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
              <div className="bg-gray-100 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wider">Items Being Returned</h4>
                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">{items.length}</span>
              </div>
              
              <div className="p-4 space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="relative bg-white p-4 rounded border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-end">
                    
                    {/* Remove Button (Only show if more than 1 item) */}
                    {items.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => removeItem(index)}
                        className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-200 border border-red-200 shadow-sm"
                        title="Remove Item"
                      >
                        &times;
                      </button>
                    )}

                    <div className="flex-1 w-full">
                      <label className="block text-xs font-bold text-gray-500 mb-1">Product ID / Name <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        required 
                        value={item.itemId} 
                        onChange={e => handleItemChange(index, 'itemId', e.target.value)} 
                        className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm" 
                      />
                    </div>
                    
                    <div className="w-full md:w-24">
                      <label className="block text-xs font-bold text-gray-500 mb-1">Qty <span className="text-red-500">*</span></label>
                      <input 
                        type="number" 
                        min="1" 
                        required 
                        value={item.quantity} 
                        onChange={e => handleItemChange(index, 'quantity', Number(e.target.value))} 
                        className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm" 
                      />
                    </div>
                  
                    <div className="w-full md:w-40">
                      <label className="block text-xs font-bold text-gray-500 mb-1">Condition</label>
                      <select 
                        value={item.condition} 
                        onChange={e => handleItemChange(index, 'condition', e.target.value)} 
                        className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      >
                        <option value="restockable">RESTOCKABLE</option>
                        <option value="damaged">DAMAGED</option>
                      </select>
                    </div>
                  </div>
                ))}

                <button 
                  type="button" 
                  onClick={addItem}
                  className="w-full py-2 border-2 border-dashed border-gray-300 rounded text-gray-500 font-medium hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
                >
                  <span>+</span> Add Another Item
                </button>
              </div>
            </div>

            {/* Bottom Section: Refund & Notes */}
            <div className="space-y-4">
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                <label className="block text-sm font-bold text-gray-800 mb-1">Total Refund Amount (₦)</label>
                <p className="text-xs text-gray-600 mb-2">Enter 0 for exchanges with no cash back.</p>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500 font-bold">₦</span>
                  <input 
                    type="number" 
                    min="0" 
                    step="0.01" 
                    required 
                    value={refundAmount} 
                    onChange={e => setRefundAmount(Number(e.target.value))} 
                    className="w-full border border-orange-200 p-2 pl-8 rounded focus:ring-2 focus:ring-orange-500 outline-none font-bold text-lg text-gray-800" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Notes / Reason</label>
                <textarea 
                  rows={2} 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                  className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none resize-none" 
                  placeholder="Brief explanation..." 
                />
              </div>
            </div>
            
          </form>
        </div>

        {/* Modal Footer - Pinned to bottom */}
        <div className="bg-gray-50 p-4 border-t border-gray-200 shrink-0 flex flex-col space-y-3">
          <button 
            type="submit" 
            form="return-form" // Triggers the form submission above
            disabled={isSubmitting}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {isSubmitting ? 'Processing...' : 'Confirm Return'}
          </button>
          <button 
            type="button" 
            onClick={onClose} 
            disabled={isSubmitting}
            className="w-full px-4 py-3 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors font-medium"
          >
            Cancel
          </button>
        </div>
        
      </div>
    </div>
  );
};