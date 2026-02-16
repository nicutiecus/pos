import React, { useEffect, useState } from 'react';
import api from '../../api/axiosInstance';
import { useAppDispatch } from '../../store/hooks';
import { addToCart } from '../../store/slices/cartSlice';

interface Product {
  id: number;
  name: string;
  sku: string;
  selling_price: string; // API sends string
  current_stock: number;
  category_name?: string;
}

const ProductGrid: React.FC = () => {
  const dispatch = useAppDispatch();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await api.get('/inventory/products');
        setProducts(res.data);
      } catch (err) {
        console.error("Failed to load products", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Filter Logic
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddToCart = (product: Product) => {
    if (product.current_stock <= 0) {
        alert("Item is out of stock!");
        return;
    }
    
    dispatch(addToCart({
      id: product.id,
      name: product.name,
      price: Number(product.selling_price),
      sku: product.sku
    }));
  };

  if (isLoading) return <div className="p-10 text-center">Loading Catalog...</div>;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Search Bar */}
      <div className="p-4 bg-white shadow-sm z-10 sticky top-0">
        <input 
          type="text" 
          placeholder="Search items by Name or SKU..." 
          className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-lg"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          autoFocus
        />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <button 
              key={product.id} 
              onClick={() => handleAddToCart(product)}
              disabled={product.current_stock <= 0}
              className={`flex flex-col text-left p-4 rounded-xl shadow-sm border transition-all active:scale-95 ${
                product.current_stock > 0 
                  ? 'bg-white border-gray-200 hover:border-blue-500 hover:shadow-md' 
                  : 'bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed'
              }`}
            >
              <div className="flex justify-between items-start w-full mb-2">
                <span className="text-xs font-bold text-gray-400 uppercase">{product.sku}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${product.current_stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                   {product.current_stock} Left
                </span>
              </div>
              
              <h3 className="font-bold text-gray-800 text-lg leading-tight mb-auto">{product.name}</h3>
              
              <div className="mt-4 text-xl font-bold text-blue-600">
                ₦{Number(product.selling_price).toLocaleString()}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProductGrid;