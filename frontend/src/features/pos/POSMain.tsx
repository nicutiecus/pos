import React from 'react';
import ProductGrid from './ProductGrid';
import CartSidebar from './CartSidebar';

const POSMain: React.FC = () => {
  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left: Product Grid (Takes up remaining space) */}
      <div className="flex-1 overflow-hidden relative">
        <ProductGrid />
      </div>

      {/* Right: Cart Sidebar (Fixed width handled inside component) */}
      <CartSidebar />
    </div>
  );
};

export default POSMain;