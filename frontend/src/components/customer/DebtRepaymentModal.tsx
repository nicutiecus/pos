import React, { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';
import {type Customer } from './CustomerEditModal';

interface Branch {
  id: string | number;
  name: string;
}

interface DebtRepaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customer: Customer | null;
  isAdmin: boolean;
  branches: Branch[];
  isLoadingBranches: boolean;
  branchId: string | null;
}

const DebtRepaymentModal: React.FC<DebtRepaymentModalProps> = ({ 
  isOpen, onClose, onSuccess, customer, isAdmin, branches, isLoadingBranches, branchId 
}) => {
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: 'Cash',
    notes: 'Debt repayment',
    branch_id: branchId || ''
  });

  useEffect(() => {
    if (customer && isOpen) {
      const relevantDebt = isAdmin ? customer.current_debt : customer.branch_specific_debt;
      setPaymentForm(prev => ({
        ...prev,
        amount: relevantDebt.toString(),
        branch_id: branchId || ''
      }));
    }
  }, [customer, isOpen, isAdmin, branchId]);

  if (!isOpen || !customer) return null;

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.branch_id) {
      alert("Error: Branch ID is required to process this payment.");
      return;
    }

    setIsProcessingPayment(true);
    try {
      const payload = {
        branch_id: paymentForm.branch_id,
        amount: Number(paymentForm.amount),
        method: paymentForm.method,
        notes: paymentForm.notes
      };

      const res = await api.post(`/sales/customers/${customer.id}/pay-debt/`, payload);
      const data = res.data;

      alert(`✅ ${data.message}\n\nAmount Paid: ₦${Number(data.amount).toLocaleString()}\nNew Balance: ₦${Number(data.new_balance).toLocaleString()}\nReceipt #: ${data.receipt_no}`);
      
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(`Payment failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-down">
        <div className="bg-green-50 p-5 border-b border-green-100 flex justify-between items-start">
          <div>
            <h3 className="font-bold text-lg text-green-900">Process Repayment</h3>
            <p className="text-sm text-green-700">For {customer.name}</p>
          </div>
          <button onClick={onClose} className="text-green-600 hover:text-red-500 text-xl leading-none">&times;</button>
        </div>
        
        <div className="p-5 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
          <span className="text-sm font-bold text-gray-500 uppercase">{isAdmin ? 'Total Owed:' : 'Branch Debt Owed:'}</span>
          <span className="text-xl font-extrabold text-red-600">₦{Number(customer.current_debt).toLocaleString()}</span>
        </div>

        <form onSubmit={handleProcessPayment} className="p-5 space-y-4">
          {(!branchId && isAdmin) && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Branch <span className="text-red-500">*</span>
              </label>
              <select 
                required 
                value={paymentForm.branch_id} 
                onChange={e => setPaymentForm({ ...paymentForm, branch_id: e.target.value })}
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
              max={isAdmin ? customer.current_debt : customer.branch_specific_debt}
              value={paymentForm.amount} 
              onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
              className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-lg font-bold text-gray-900" 
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Payment Method</label>
            <select 
              value={paymentForm.method} 
              onChange={e => setPaymentForm({ ...paymentForm, method: e.target.value })}
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
              value={paymentForm.notes} 
              onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })}
              className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm" 
              placeholder="e.g. Paid via GTBank transfer"
            />
          </div>
          
          <div className="pt-4 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors">Cancel</button>
            <button type="submit" disabled={isProcessingPayment || !paymentForm.amount} className="px-5 py-2.5 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 transition-colors shadow-md">
              {isProcessingPayment ? 'Processing...' : 'Confirm Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DebtRepaymentModal;