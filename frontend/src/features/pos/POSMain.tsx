import React, { useState } from 'react';
import ProductGrid from './ProductGrid';
import CartSidebar from './CartSidebar';
import DebtRepaymentModal from './DebtRepaymentModal';
import ShiftGuard from './ShiftGuard';
import { ReturnGoodsModal } from './ReturnGoodsModal';

const POSMain: React.FC = () => {
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  // State to manage drawer visibility on tablet/mobile
  const [isCartOpen, setIsCartOpen] = useState(false);

  return (
    <ShiftGuard>
      <div className="flex flex-col lg:flex-row h-full w-full overflow-hidden relative">
        
        {/* --- MAIN CONTENT AREA (Header + Product Grid) --- */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <header className="bg-gray-800 text-white p-4 flex justify-between items-center">
            
            {/* The Action Buttons */}
            <div className="flex flex-col space-y-2">
              <button 
                onClick={() => setIsDebtModalOpen(true)}
                className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded font-bold shadow-sm transition-colors"
              >
                💳 Clear Customer Debt
              </button>
            </div>

            {/* View Cart Button (Visible only on Mobile/Tablet) */}
            <button 
              onClick={() => setIsCartOpen(true)}
              className="lg:hidden bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md font-bold shadow-sm transition-colors flex items-center gap-2"
            >
              <span>🛒</span> View Cart
            </button>
          </header>

          {/* Left: Product Grid (Takes up remaining vertical space) */}
          <div className="flex-1 overflow-hidden relative">
            <ProductGrid />
          </div>
        </div>

        {/* --- BACKDROP OVERLAY --- */}
        {/* Dims the background when the drawer is open on small screens */}
        {isCartOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
            onClick={() => setIsCartOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* --- CART SIDEBAR DRAWER --- */}
        <div 
          className={`
            fixed inset-y-0 right-0 z-50 w-80 sm:w-96 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out
            lg:relative lg:translate-x-0 lg:shadow-none lg:border-l lg:border-gray-200 flex-shrink-0
            ${isCartOpen ? 'translate-x-0' : 'translate-x-full'}
          `}
        >
          <CartSidebar onClose={() => setIsCartOpen(false)} />
        </div>

        {/* Modals */}
        {isDebtModalOpen && (
          <DebtRepaymentModal onClose={() => setIsDebtModalOpen(false)} />
        )}
        <ReturnGoodsModal 
          isOpen={isReturnModalOpen} 
          onClose={() => setIsReturnModalOpen(false)} 
        />
        
      </div>
    </ShiftGuard>
  );
};

export default POSMain;