import React, { useState } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { clearCart } from '../../store/slices/cartSlice';
import api from '../../api/axiosInstance';

interface Props {
  total: number;
  onClose: () => void;
}

const PaymentModal: React.FC<Props> = ({ total, onClose }) => {
  const dispatch = useAppDispatch();
  const cartItems = useAppSelector(state => state.cart.items);
  
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER' | 'POS'>('CASH');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCheckout = async () => {
    setIsProcessing(true);
    try {
      // Construct Payload
      const payload = {
        payment_method: paymentMethod,
        total_amount: total,
        items: cartItems.map(item => ({
          product_id: item.id,
          quantity: item.quantity,
          unit_price: item.price
        }))
      };

      // Send to Backend
      await api.post('/sales', payload);

      // Success
      alert('Sale Completed Successfully!');
      dispatch(clearCart());
      onClose();
      
    } catch (err) {
      console.error(err);
      alert('Transaction Failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
        
        <div className="bg-gray-50 p-6 border-b border-gray-200 text-center">
          <h3 className="text-lg font-medium text-gray-500">Amount Due</h3>
          <div className="text-4xl font-extrabold text-gray-900 mt-1">₦{total.toLocaleString()}</div>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Select Payment Method</label>
            <div className="grid grid-cols-3 gap-3">
              {(['CASH', 'TRANSFER', 'POS'] as const).map(method => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`py-3 rounded-lg border-2 font-bold text-sm transition-all ${
                    paymentMethod === method 
                      ? 'border-blue-600 bg-blue-50 text-blue-700' 
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <button 
              onClick={handleCheckout}
              disabled={isProcessing}
              className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-700 disabled:opacity-50 flex justify-center items-center"
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Processing...
                </span>
              ) : `Confirm Payment`}
            </button>
            
            <button 
              onClick={onClose}
              disabled={isProcessing}
              className="w-full py-3 text-gray-500 font-medium hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;