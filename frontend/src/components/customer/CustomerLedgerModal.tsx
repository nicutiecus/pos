import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api/axiosInstance';
import { formatBackendDate } from '../../utils/dateFormatter';
import { type Customer } from './CustomerEditModal';

interface LedgerEntry {
  id: string;
  created_at: string;
  transaction_type: 'Sale' | 'Payment' | 'Refund' | 'Reversal';
  amount: string;
  payment_method: string;
  balance_after: string;
  reference_id: string;
}

interface CustomerLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  isAdmin: boolean;
  branchId: string | null;
  onSuccess?: () => void; // Fix: Added missing prop
}

const CustomerLedgerModal: React.FC<CustomerLedgerModalProps> = ({ isOpen, onClose, customer, isAdmin, branchId, onSuccess }) => {
  const [ledgerData, setLedgerData] = useState<LedgerEntry[]>([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);

  const fetchLedger = useCallback(async () => {
    if (!customer) return;
    setIsLoadingLedger(true);
    try {
      const params = new URLSearchParams();
      if (!isAdmin && branchId) {
        params.append('branch_id', branchId);
      }
      const res = await api.get(`/sales/customers/${customer.id}/ledger/?${params.toString()}`);
      setLedgerData(res.data);
    } catch (err) {
      console.error("Failed to fetch ledger", err);
      setLedgerData([]);
    } finally {
      setIsLoadingLedger(false);
    }
  }, [customer, isAdmin, branchId]); // Fix: Corrected syntax error

  useEffect(() => {
    if (isOpen) {
      fetchLedger();
    }
  }, [isOpen, fetchLedger]);

  const handleReversePayment = async (paymentId: string) => {
    const reason = window.prompt("Are you sure you want to reverse this payment? Enter a reason (required):");
    
    if (reason === null) return;
    
    if (!reason.trim()) {
      alert("A reason is required to reverse a payment.");
      return;
    }

    try {
      const response = await api.post(`/sales/payments/${paymentId}/reverse/`, {
        reason: reason.trim()
      });
      
      alert(`✅ ${response.data.message}`);
      
      await fetchLedger(); 
      
      if (onSuccess) {
          onSuccess();
      }
      
    } catch (err: any) {
      alert(`Reversal failed: ${err.response?.data?.error || err.message}`);
    }
  };

  if (!isOpen || !customer) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in">
        <div className="bg-gray-50 p-4 border-b flex justify-between items-start">
          <div>
            <h3 className="font-bold text-lg text-gray-800">Ledger: {customer.name}</h3>
            <p className="text-sm text-gray-500 font-mono">{customer.phone}</p>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-gray-500 uppercase">Current Debt</div>
            <div className={`text-xl font-bold ${(isAdmin ? customer.current_debt : customer.branch_specific_debt) > 0 ? 'text-red-600' : 'text-green-600'}`}>
              ₦{Number(isAdmin ? customer.current_debt : customer.branch_specific_debt).toLocaleString()}
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {isLoadingLedger ? (
            <div className="text-center text-gray-400 py-10">Loading Ledger History...</div>
          ) : ledgerData.length === 0 ? (
            <div className="text-center text-gray-400 py-10 italic">No ledger history found for this customer.</div>
          ) : (
            <div className="space-y-3">
              {ledgerData.map((entry, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 border rounded-lg bg-white shadow-sm">
                  <div>
                    <div className="text-xs text-gray-400">{formatBackendDate(entry.created_at)}</div>
                    <div className="font-bold text-sm text-gray-700">
                      {entry.transaction_type === 'Sale' ? '🛍️ Credit Purchase' : 
                      entry.transaction_type === 'Payment' ? '💰 Debt Repayment' :
                      entry.transaction_type === 'Reversal' ? '↩️ Payment Reversal' : 'Refund'}
                      <span className="ml-2 font-mono text-xs text-gray-400">Ref: {entry.reference_id}</span>
                    </div>
                  </div>
                  
                  {/* Fix: Grouped right-side elements into a single flex-container */}
                  <div className="text-right flex flex-col items-end gap-2">
                    <div>
                      <div className={`font-bold ${entry.transaction_type === 'Payment' ? 'text-green-600' : 'text-red-600'}`}>
                        {entry.transaction_type === 'Payment' ? '-' : '+'} ₦{Number(entry.amount).toLocaleString()}
                      </div>
                      <p className="text-xs text-gray-500 mt-1 font-medium">Method: {entry.payment_method}</p>
                      <div className="text-xs text-gray-500">Balance: ₦{Number(entry.balance_after).toLocaleString()}</div>
                    </div>
                    {entry.transaction_type === 'Payment' && isAdmin && (
                        <button 
                          onClick={() => handleReversePayment(entry.reference_id)}
                          className="text-[10px] uppercase font-bold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition-colors"
                        >
                          Reverse
                        </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-4 bg-gray-50 border-t flex justify-end">
          <button onClick={onClose} className="px-6 py-2 bg-gray-800 text-white rounded font-bold hover:bg-gray-900">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerLedgerModal;