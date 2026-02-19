import React, { useEffect, useState } from 'react';
import api from '../../api/axiosInstance';
import { useAppDispatch } from '../../store/hooks';
import { addToCart } from '../../store/slices/cartSlice';

// --- Interfaces ---

// 1. Static Data (From /inventory/catalog)
interface CatalogItem {
  id: number;
  name: string;
  sku: string;
  selling_price: string;
  category?: string;
  image?: string;
}

// 2. Dynamic Data (From /inventory/levels/{branch_id}/)
interface StockItem {
  id: number;
  total_quantity: number;
}

// 3. Merged Data (What the Grid displays)
interface Product extends CatalogItem {
  available_qty: number;
}

const ProductGrid: React.FC = () => {
  const dispatch = useAppDispatch();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  const branchId = localStorage.getItem('branchId');

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        if (!branchId) throw new Error("Branch ID missing");

        // 1. Parallel Fetch: Get Catalog AND Stock Levels simultaneously
        const [catalogRes, stockRes] = await Promise.all([
          api.get('/inventory/catalog'),            // "What do we sell?"
          api.get(`/inventory/levels/${branchId}/`)  // "How much is here?"
        ]);

        const catalog: CatalogItem[] = catalogRes.data;
        const stockList: StockItem[] = stockRes.data;

        // 2. Create a Stock Map for fast lookup (O(1))
        // Map: { [product_id]: quantity }
        const stockMap = new Map<number, number>();
        stockList.forEach(item => {
          stockMap.set(item.id, item.total_quantity);
        });

        // 3. Merge Lists
        // We map through the CATALOG (primary source of truth for items)
        // and attach the quantity from the Stock Map.
        const mergedProducts: Product[] = catalog.map(item => ({
          ...item,
          // Default to 0 if this branch has no record of this item in stock
          available_qty: stockMap.get(item.id) || 0 
        }));

        setProducts(mergedProducts);

      } catch (err) {
        console.error("Failed to load product grid data", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [branchId]);

  // Filter Logic (Client-side)
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddToCart = (product: Product) => {
    if (product.available_qty <= 0) {
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

  if (isLoading) return <div className="p-10 text-center text-gray-500">Loading Catalog & Stock...</div>;
  if (!branchId) return <div className="p-10 text-center text-red-500">Session Error: Please relogin.</div>;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Search Bar */}
      <div className="p-4 bg-white shadow-sm z-10 sticky top-0">
        <div className="relative">
            <span className="absolute left-3 top-3 text-gray-400">🔍</span>
            <input 
              type="text" 
              placeholder="Search items by Name or SKU..." 
              className="w-full p-3 pl-10 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-lg"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredProducts.length === 0 ? (
           <div className="text-center text-gray-400 mt-10">No products found.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map((product) => (
              <button 
                key={product.id} 
                onClick={() => handleAddToCart(product)}
                disabled={product.available_qty <= 0}
                className={`flex flex-col text-left p-4 rounded-xl shadow-sm border transition-all active:scale-95 ${
                  product.available_qty > 0 
                    ? 'bg-white border-gray-200 hover:border-blue-500 hover:shadow-md' 
                    : 'bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex justify-between items-start w-full mb-2">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{product.sku}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${product.available_qty > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                     {product.available_qty}
                  </span>
                </div>
                
                <h3 className="font-bold text-gray-800 text-lg leading-tight mb-auto line-clamp-2">{product.name}</h3>
                
                <div className="mt-4 flex justify-between items-end w-full">
                    <div className="text-xl font-bold text-blue-600">
                      ₦{Number(product.selling_price).toLocaleString()}
                    </div>
                    {product.category && (
                        <div className="text-[10px] text-gray-400 bg-gray-50 px-1 rounded">
                            {product.category}
                        </div>
                    )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductGrid;