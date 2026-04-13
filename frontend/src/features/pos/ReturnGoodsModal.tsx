// components/pos/ReturnGoodsModal.tsx
import React, { useState } from 'react';
import api from '../../api/axiosInstance'; 
import { type ReturnedGoodsPayload } from '../types/returns';

interface ReturnGoodsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReturnGoodsModal: React.FC<ReturnGoodsModalProps> = ({ isOpen, onClose }) => {
  const branchId = localStorage.getItem('branchId');

  const [formData, setFormData] = useState<ReturnedGoodsPayload>({
    receiptId: '',
    itemId: '',
    quantity: 1,
    condition: 'restockable',
    refundAmount: 0,
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'quantity' || name === 'refundAmount' ? Number(value) : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Build the payload including the branch ID
      const payload = {
        ...formData,
        branch_id: branchId
      };

      // Make the API call directly from the modal
      await api.post('/returns/process-returns/', payload);
      
      alert(`✅ Return processed successfully!\nReceipt: ${formData.receiptId}\nRefunded: ₦${formData.refundAmount.toLocaleString()}`);
      
      // Reset form on success
      setFormData({
        receiptId: '', itemId: '', quantity: 1, condition: 'restockable', refundAmount: 0, notes: ''
      });
      onClose();

    } catch (error: any) {
      console.error("Failed to process return:", error);
      alert(`❌ Failed to process return: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in-down">
        
        {/* Modal Header */}
        <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <span>↩️</span> Process Returned Goods
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors text-2xl leading-none">&times;</button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Receipt ID <span className="text-red-500">*</span></label>
              <input type="text" name="receiptId" required value={formData.receiptId} onChange={handleChange} className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50" placeholder="e.g. REC-10293" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Product ID / Name <span className="text-red-500">*</span></label>
              <input type="text" name="itemId" required value={formData.itemId} onChange={handleChange} className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Quantity <span className="text-red-500">*</span></label>
              <input type="number" name="quantity" min="1" required value={formData.quantity} onChange={handleChange} className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Condition</label>
              <select name="condition" value={formData.condition} onChange={handleChange} className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="restockable">Restockable</option>
                <option value="damaged">Damaged (Write-off)</option>
              </select>
            </div>
          </div>

          <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
            <label className="block text-sm font-bold text-gray-800 mb-1">Refund Amount (₦)</label>
            <p className="text-xs text-gray-600 mb-2">Enter 0 for exchanges with no cash back.</p>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500 font-bold">₦</span>
              <input type="number" name="refundAmount" min="0" step="0.01" required value={formData.refundAmount} onChange={handleChange} className="w-full border border-orange-200 p-2 pl-8 rounded focus:ring-2 focus:ring-orange-500 outline-none font-bold text-lg text-gray-800" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Notes / Reason</label>
            <textarea name="notes" rows={2} value={formData.notes} onChange={handleChange} className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none resize-none" placeholder="Brief explanation..." />
          </div>

          {/* Modal Footer */}
          <div className="pt-4 mt-2 border-t border-gray-100 flex justify-end space-x-3">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center min-w-[140px]">
              {isSubmitting ? 'Processing...' : 'Confirm Return'}
            </button>
          </div>
          
        </form>
      </div>
    </div>
  );
};