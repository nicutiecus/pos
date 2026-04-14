import React from 'react';
import ProductGrid from './ProductGrid';
import CartSidebar from './CartSidebar';
import { useState } from 'react';
import DebtRepaymentModal from './DebtRepaymentModal';
import ShiftGuard from './ShiftGuard';
import { ReturnGoodsModal } from './ReturnGoodsModal';

const POSMain: React.FC = () => {
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
 


  return (

    <ShiftGuard>
    
    <div className="flex h-full w-full overflow-hidden">
      <header className="bg-gray-800 text-white p-4 flex justify-between items-center">
                
                {/* The New Action Button */}
              <div className='flex flex-col space-y-2' >
                {/*<button 
                onClick={() => setIsReturnModalOpen(true)}
                className="bg-orange-500 hover:bg-orange-400 px-4 py-2 rounded font-bold shadow-sm transition-colors"
                >
                ↩️ Process Return
                </button>
                */}
                <button 
                    onClick={() => setIsDebtModalOpen(true)}
                    className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded font-bold shadow-sm"
                >
                    💳 Clear Customer Debt
                </button>
              </div>
            </header>
      {/* Left: Product Grid (Takes up remaining space) */}
      <div className="flex-1 overflow-hidden relative">
        <ProductGrid />
      </div>

      {/* Right: Cart Sidebar (Fixed width handled inside component) */}
      <CartSidebar />

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