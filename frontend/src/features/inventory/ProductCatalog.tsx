import React, { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import api from '../../api/axiosInstance';
//import { isAxiosError } from 'axios';

// --- Domain Interfaces ---
interface Product {
  id: number;
  name: string;
  sku: string;
  price: string; // Decimal often comes as string from API
  unit: string; // e.g., 'kg', 'carton', 'pallet'
  current_stock: number;
  low_stock_threshold: number;
}

interface NewProductPayload {
  name: string;
  sku: string;
  price: string;
  unit: string;
  low_stock_threshold: number;
}

interface StockReceivePayload {
  product_id: number;
  quantity_received: number;
  batch_number: string;     // Crucial for Coldroom (First-In-First-Out)
  expiry_date: string;      // Crucial for Coldroom
  cost_price: string;       // For Profit/Loss calculation
}

const ProductCatalog: React.FC = () => {
  // --- Global State ---
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  //const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // --- UI Toggles ---
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeReceiveId, setActiveReceiveId] = useState<number | null>(null); // Which product is being restocked?

  // --- Forms State ---
  const [newProduct, setNewProduct] = useState<NewProductPayload>({
    name: '', sku: '', price: '', unit: 'carton', low_stock_threshold: 10
  });

  const [stockEntry, setStockEntry] = useState<StockReceivePayload>({
    product_id: 0, quantity_received: 0, batch_number: '', expiry_date: '', cost_price: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Initial Fetch ---
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await api.get('/inventory/products');
      setProducts(response.data);
    } catch (err) {
      console.error("Fetch failed", err);
      // Fallback for demo if API isn't ready
      // setProducts([]); 
    } finally {
      setIsLoading(false);
    }
  };

  // --- Handlers: Create Product ---
  const handleCreateChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setNewProduct({ ...newProduct, [e.target.name]: e.target.value });
  };

  const submitCreateProduct = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await api.post('/inventory/products', newProduct);
      setProducts([res.data, ...products]); // Prepend to list
      setShowCreateForm(false);
      setNewProduct({ name: '', sku: '', price: '', unit: 'carton', low_stock_threshold: 10 });
    } catch (err) {
      alert("Failed to create product");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Handlers: Receive Stock ---
  const initiateReceive = (product: Product) => {
    setActiveReceiveId(product.id);
    // Pre-fill defaults
    setStockEntry({
      product_id: product.id,
      quantity_received: 1,
      batch_number: '',
      expiry_date: '',
      cost_price: ''
    });
  };

  const handleStockChange = (e: ChangeEvent<HTMLInputElement>) => {
    setStockEntry({ ...stockEntry, [e.target.name]: e.target.value });
  };

  const submitStockReceive = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeReceiveId) return;
    setIsSubmitting(true);

    try {
      // POST to a specialized inventory transaction endpoint
      await api.post(`/inventory/receive`, {
        ...stockEntry,
        product_id: activeReceiveId
      });

      // Optimistic Update: Find product and increase stock locally
      const updatedProducts = products.map(p => 
        p.id === activeReceiveId 
          ? { ...p, current_stock: p.current_stock + Number(stockEntry.quantity_received) }
          : p
      );
      setProducts(updatedProducts);
      
      setActiveReceiveId(null); // Close the row
      alert(`Stock Received Successfully!`);

    } catch (err) {
      console.error(err);
      alert("Failed to receive stock. Check console.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading Inventory...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Header & Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-sm text-gray-500">Manage products and incoming shipments</p>
        </div>
        <button 
          onClick={() => setShowCreateForm(!showCreateForm)}
          className={`px-4 py-2 rounded-md font-medium text-white transition-colors ${
            showCreateForm ? 'bg-gray-500 hover:bg-gray-600' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {showCreateForm ? 'Cancel' : '+ Add New Product'}
        </button>
      </div>

      {/* --- CREATE PRODUCT FORM (Collapsible) --- */}
      {showCreateForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 shadow-sm animate-fade-in-down">
          <h3 className="text-sm font-bold text-blue-800 uppercase mb-4">Define New Product</h3>
          <form onSubmit={submitCreateProduct} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700">Product Name</label>
              <input type="text" name="name" value={newProduct.name} onChange={handleCreateChange} required placeholder="e.g. Frozen Mackerel 20kg"
                className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 text-sm focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">SKU / Code</label>
              <input type="text" name="sku" value={newProduct.sku} onChange={handleCreateChange} required placeholder="e.g. FISH-001"
                className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 text-sm focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Selling Price</label>
              <input type="number" name="price" value={newProduct.price} onChange={handleCreateChange} required placeholder="0.00"
                className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 text-sm focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Unit Type</label>
              <select name="unit" value={newProduct.unit} onChange={handleCreateChange}
                className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 text-sm bg-white focus:ring-blue-500 focus:border-blue-500">
                <option value="carton">Carton</option>
                <option value="kg">Kilogram</option>
                <option value="pallet">Pallet</option>
                <option value="piece">Piece</option>
              </select>
            </div>
            <div className="md:col-span-5 flex justify-end">
              <button type="submit" disabled={isSubmitting} 
                className="bg-blue-700 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-800 disabled:opacity-50">
                {isSubmitting ? 'Saving...' : 'Save Product'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- PRODUCT LIST --- */}
      <div className="bg-white border border-gray-200 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Info</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Stock</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products.length === 0 ? (
               <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No products found. Add your first item above!</td></tr>
            ) : (
              products.map((product) => (
                <React.Fragment key={product.id}>
                  {/* --- Main Row --- */}
                  <tr className={`hover:bg-gray-50 transition-colors ${activeReceiveId === product.id ? 'bg-blue-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{product.name}</div>
                      <div className="text-xs text-gray-500">Unit: {product.unit}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{product.sku}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">₦{product.price}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        product.current_stock <= product.low_stock_threshold 
                          ? 'bg-red-100 text-red-800 animate-pulse' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {product.current_stock}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {activeReceiveId === product.id ? (
                        <button onClick={() => setActiveReceiveId(null)} className="text-gray-500 hover:text-gray-700">Cancel</button>
                      ) : (
                        <button onClick={() => initiateReceive(product)} className="text-blue-600 hover:text-blue-900 border border-blue-200 px-3 py-1 rounded bg-white shadow-sm hover:bg-blue-50">
                          Restock
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* --- STOCK RECEIVING "DRAWER" (Conditional Render Row) --- */}
                  {activeReceiveId === product.id && (
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <td colSpan={5} className="px-6 py-4">
                        <form onSubmit={submitStockReceive} className="flex flex-wrap items-end gap-4 bg-white p-4 rounded border border-gray-200 shadow-inner">
                           <div className="w-full text-xs font-bold text-gray-500 uppercase">Receiving Stock for: {product.name}</div>
                           
                           <div>
                             <label className="block text-xs font-medium text-gray-700">Quantity In</label>
                             <input type="number" name="quantity_received" value={stockEntry.quantity_received} onChange={handleStockChange} required min="1"
                               className="mt-1 w-24 rounded border-gray-300 p-1 text-sm focus:ring-blue-500 focus:border-blue-500" />
                           </div>
                           
                           <div>
                             <label className="block text-xs font-medium text-gray-700">Cost Price (Per Unit)</label>
                             <input type="number" name="cost_price" value={stockEntry.cost_price} onChange={handleStockChange} placeholder="0.00"
                               className="mt-1 w-28 rounded border-gray-300 p-1 text-sm focus:ring-blue-500 focus:border-blue-500" />
                           </div>

                           <div>
                             <label className="block text-xs font-medium text-gray-700">Batch Number</label>
                             <input type="text" name="batch_number" value={stockEntry.batch_number} onChange={handleStockChange} placeholder="BATCH-001"
                               className="mt-1 w-32 rounded border-gray-300 p-1 text-sm focus:ring-blue-500 focus:border-blue-500" />
                           </div>

                           <div>
                             <label className="block text-xs font-medium text-gray-700">Expiry Date</label>
                             <input type="date" name="expiry_date" value={stockEntry.expiry_date} onChange={handleStockChange} required
                               className="mt-1 w-36 rounded border-gray-300 p-1 text-sm focus:ring-blue-500 focus:border-blue-500" />
                           </div>

                           <div className="ml-auto">
                             <button type="submit" disabled={isSubmitting} className="bg-green-600 text-white px-4 py-1.5 rounded text-sm hover:bg-green-700 disabled:opacity-50 shadow-sm">
                               {isSubmitting ? 'Processing...' : 'Confirm Receipt'}
                             </button>
                           </div>
                        </form>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProductCatalog;