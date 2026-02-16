import React, { useState } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { removeFromCart, decreaseQuantity, addToCart, clearCart } from '../../store/slices/cartSlice';
import PaymentModal from './PaymentModal'; // We will build this next

const CartSidebar: React.FC = () => {
  const dispatch = useAppDispatch();
  const { items, totalAmount } = useAppSelector((state) => state.cart);
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);

  // Helper to re-add item (increase qty)
  const increaseQty = (item: any) => {
    dispatch(addToCart({ ...item })); // Re-dispatching adds 1
  };

  return (
    <>
      <div className="flex flex-col h-full bg-white border-l border-gray-200 shadow-xl w-96 flex-shrink-0">
        
        {/* Header */}
        <div className="p-5 bg-gray-900 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Current Order</h2>
            <p className="text-xs text-gray-400">Order #{Date.now().toString().slice(-6)}</p>
          </div>
          <button onClick={() => dispatch(clearCart())} className="text-xs text-red-300 hover:text-white underline">
            Clear
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
              <svg className="w-16 h-16 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
              <p>Cart is empty</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex justify-between items-center">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-800 text-sm truncate w-40">{item.name}</h4>
                  <div className="text-xs text-gray-500 font-mono">₦{item.price.toLocaleString()}</div>
                </div>
                
                {/* Quantity Controls */}
                <div className="flex items-center bg-gray-100 rounded-lg p-1">
                   <button onClick={() => dispatch(decreaseQuantity(item.id))} className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 hover:bg-gray-200 font-bold">-</button>
                   <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                   <button onClick={() => increaseQty(item)} className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-blue-600 hover:bg-blue-50 font-bold">+</button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-white border-t border-gray-200">
          <div className="space-y-2 mb-6">
            <div className="flex justify-between text-gray-500 text-sm">
              <span>Subtotal</span>
              <span>₦{totalAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xl font-extrabold text-gray-900">
              <span>Total</span>
              <span>₦{totalAmount.toLocaleString()}</span>
            </div>
          </div>
          
          <button 
            disabled={items.length === 0}
            onClick={() => setPaymentModalOpen(true)}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-95"
          >
            Pay ₦{totalAmount.toLocaleString()}
          </button>
        </div>
      </div>

      {/* Payment Modal Popup */}
      {isPaymentModalOpen && (
        <PaymentModal 
          total={totalAmount} 
          onClose={() => setPaymentModalOpen(false)} 
        />
      )}
    </>
  );
};

export default CartSidebar;