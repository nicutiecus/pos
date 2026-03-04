import React, { useEffect, useState } from 'react';
import api from '../../api/axiosInstance';
import { useAppDispatch } from '../../store/hooks';
import { addToCart } from '../../store/slices/cartSlice';
// Import your new offline DB utilities
import { saveProductsLocally, getLocalProducts } from '../../utils/offlineDb';

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
export interface Product extends CatalogItem {
  available_qty: number;
}

const ProductGrid: React.FC = () => {
  const dispatch = useAppDispatch();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // New state to track if we are running from the local cache
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  
  const branchId = localStorage.getItem('branchId');

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        if (!branchId) throw new Error("Branch ID missing");

        // 1. Attempt to fetch fresh data from the server
        const [catalogRes, stockRes] = await Promise.all([
          api.get('/inventory/catalog/'),
          api.get(`/inventory/levels/${branchId}/`)
        ]);

        // 2. Merge logic
        const catalogItems: CatalogItem[] = catalogRes.data;
        const stockItems: StockItem[] = stockRes.data;

        const mergedProducts: Product[] = catalogItems.map(catalogItem => {
          const matchingStock = stockItems.find(s => s.id === catalogItem.id);
          return {
            ...catalogItem,
            available_qty: matchingStock ? matchingStock.total_quantity : 0
          };
        });

        // 3. Update UI and reset offline flag
        setProducts(mergedProducts);
        setIsOfflineMode(false);

        // 4. Save the fresh merged data to IndexedDB for future offline use
        try {
            await saveProductsLocally(mergedProducts);
        } catch (dbErr: any) { // FIX: Added explicit 'any' type
            console.error("Failed to cache products to IndexedDB:", dbErr);
        }

      } catch (err: any) {
        console.error("Network request failed, falling back to local DB...", err);
        
        // --- OFFLINE FALLBACK LOGIC ---
        try {
            const localData = await getLocalProducts();
            if (localData && localData.length > 0) {
                setProducts(localData);
                setIsOfflineMode(true); // Trigger the offline UI banner
            } else {
                console.error("No local data found. System cannot operate offline yet.");
            }
        } catch (fallbackErr: any) { // FIX: Added explicit 'any' type
            console.error("Failed to retrieve from local DB:", fallbackErr);
        }

      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [branchId]);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col p-4 bg-gray-50 overflow-hidden relative">
      
      {/* OFFLINE MODE BANNER */}
      {isOfflineMode && (
          <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-800 p-3 mb-4 rounded shadow-sm flex items-center justify-between animate-fade-in">
              <div className="flex items-center gap-2">
                  <span className="text-xl">⚠️</span>
                  <div>
                      <p className="font-bold text-sm">Offline Mode Active</p>
                      <p className="text-xs">You are disconnected. Browsing catalog from local storage.</p>
                  </div>
              </div>
          </div>
      )}

      {/* Search Bar */}
      <div className="mb-4">
        <input 
          type="text" 
          placeholder="Search products by name or SKU..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 pl-4 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow font-medium"
        />
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
           Syncing Catalog...
        </div>
      ) : (
        /* Product Grid */
        <div className="flex-1 overflow-y-auto pr-2 pb-20">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map(product => (
              <button 
                key={product.id}
                onClick={() => {
                  if (product.available_qty > 0) {
                      dispatch(addToCart({
                          id: product.id,
                          name: product.name,
                          price: Number(product.selling_price),
                          sku: product.sku
                          // FIX: Removed 'quantity: 1' to satisfy the Omit<CartItem, "quantity"> Redux constraint
                      }));
                  }
                }}
                disabled={product.available_qty <= 0}
                className={`p-4 rounded-xl flex flex-col text-left transition-all duration-200 border ${
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
          
          {filteredProducts.length === 0 && !isLoading && (
            <div className="text-center text-gray-500 mt-10 p-8 bg-white rounded-xl border border-dashed border-gray-300">
                No products found matching "{searchTerm}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductGrid;