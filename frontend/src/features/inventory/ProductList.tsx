import React, { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import api from '../../api/axiosInstance';
import { isAxiosError } from 'axios';

// --- Types ---
interface Category {
  id: number;
  name: string;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  category_id: number;
  cost_price: string;
  selling_price: string;
  unit_type: string;
  has_sub_unit: boolean;
  sub_unit_ratio?: string;
  attributes?: Record<string, string>;
}

interface NewProductPayload {
  name: string;
  sku: string;
  category_id: number;
  cost_price: string;
  selling_price: string;
  unit_type: string;
  has_sub_unit: boolean;
  sub_unit_ratio: string;
  attributesStr: string; // We use a string input for the JSON attributes
}

// --- Inline Editable Price Component ---
interface EditablePriceCellProps {
  productId: number;
  initialPrice: string | number;
  onSuccess: (newPrice: string) => void;
}

const EditablePriceCell: React.FC<EditablePriceCellProps> = ({ productId, initialPrice, onSuccess }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [price, setPrice] = useState<string>(String(initialPrice));
  const [isSaving, setIsSaving] = useState(false);
   

  const handleSave = async () => {
    const numericPrice = Number(price);
    
    if (isNaN(numericPrice) || numericPrice < 0) {
      alert("Please enter a valid price.");
      return;
    }
    
    if (numericPrice === Number(initialPrice)) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await api.patch(`/inventory/products/${productId}/price/`, {
        new_price: numericPrice
      });
      
      onSuccess(String(numericPrice));
      setIsEditing(false);
    } catch (err: any) {
      alert(`Failed to update price: ${err.response?.data?.message || err.message}`);
      setPrice(String(initialPrice));
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setPrice(String(initialPrice));
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1 mt-1">
        <span className="text-gray-500 font-bold text-xs">₦</span>
        <input
          type="number"
          min="0"
          autoFocus
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-20 p-1 border border-blue-500 rounded outline-none text-xs font-bold"
          disabled={isSaving}
        />
        {isSaving ? (
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
        ) : (
          <>
            <button onClick={handleSave} className="text-green-600 hover:text-green-800 p-1" title="Save (Enter)">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
            </button>
            <button onClick={() => { setIsEditing(false); setPrice(String(initialPrice)); }} className="text-red-500 hover:text-red-700 p-1" title="Cancel (Esc)">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div 
      className="flex items-center gap-2 mt-1 group cursor-pointer hover:bg-gray-100 p-1 -ml-1 rounded transition-colors" 
      onClick={() => setIsEditing(true)}
      title="Click to edit selling price"
    >
      <div className="font-bold">
        <span className="text-gray-500 text-xs font-normal">Sell:</span> ₦{Number(initialPrice).toLocaleString()}
      </div>
      <button className="text-gray-300 group-hover:text-blue-500 transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
      </button>
    </div>
  );
};

// --- Main Component ---
const ProductList: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const userRole = localStorage.getItem('userRole');
  const userPermissions = JSON.parse(localStorage.getItem('userPermissions') || '[]');
  const canCreateProducts = userRole === 'Tenant_Admin' || userRole === 'Super_Admin' || userPermissions.includes('create_products');


  // Form State
  const [newProduct, setNewProduct] = useState<NewProductPayload>({
    name: '', 
    sku: '', 
    category_id: 1, 
    cost_price: '',
    selling_price: '',
    unit_type: 'Unit', // Default
    has_sub_unit: false,
    sub_unit_ratio: '1.00',
    attributesStr: '' 
  });

  // --- Initial Load ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prodRes, catRes] = await Promise.all([
          api.get('/inventory/products'),
          api.get('/inventory/categories')
        ]);
        setProducts(prodRes.data);
        setCategories(catRes.data);
      } catch (err) {
        console.error("Fetch failed", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleCreateChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    
    setNewProduct({ 
      ...newProduct, 
      [e.target.name]: value 
    });
  };

  const submitCreateProduct = async (e: FormEvent) => {
    e.preventDefault();
    if (!newProduct.category_id) {
        setErrorMsg("Please select a category.");
        return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // Construct the Base Payload
      const payload: any = {
        name: newProduct.name,
        sku: newProduct.sku,
        category_id: newProduct.category_id,
        cost_price: newProduct.cost_price,
        selling_price: newProduct.selling_price,
        unit_type: newProduct.unit_type,
        has_sub_unit: newProduct.has_sub_unit
      };

      // Conditionally Add Sub-Unit Fields
      if (newProduct.has_sub_unit) {
        payload.sub_unit_ratio = newProduct.sub_unit_ratio;
        
        // Parse Attributes JSON
        if (newProduct.attributesStr.trim()) {
            try {
                payload.attributes = JSON.parse(newProduct.attributesStr);
            } catch (e) {
                setErrorMsg("Invalid JSON format for Attributes.");
                setIsSubmitting(false);
                return;
            }
        } else {
            payload.attributes = {}; // Send empty object if empty string
        }
      }

      const res = await api.post('/inventory/products/', payload);
      
      setProducts([res.data, ...products]); 
      setShowCreateForm(false);
      
      // Reset Form
      setNewProduct({ 
        name: '', sku: '', category_id: 1, 
        cost_price: '', selling_price: '', 
        unit_type: 'Unit', has_sub_unit: false, 
        sub_unit_ratio: '1.00', attributesStr: '' 
      });

      alert("Product Created Successfully!");
      
    } catch (err) {
       if (isAxiosError(err)) {
        setErrorMsg(err.response?.data?.message || `Error: ${err.response?.status} - ${err.response?.statusText}`);
      } else {
        setErrorMsg('An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Master</h1>
          <p className="text-sm text-gray-500">Define the items your store sells.</p>
        </div>
        {canCreateProducts && (
        <button onClick={() => setShowCreateForm(!showCreateForm)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium">
          {showCreateForm ? 'Cancel' : '+ Define New Product'}
        </button>

        )}
      </div>

      {showCreateForm &&  (
        <div className="bg-white border border-blue-200 rounded-lg p-6 shadow-md animate-fade-in-down">
          <h3 className="text-sm font-bold text-gray-800 uppercase mb-4">New Product Definition</h3>
          {errorMsg && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded">{errorMsg}</div>}

          <form onSubmit={submitCreateProduct} className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            
            {/* --- LEFT COLUMN: CORE INFO --- */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Product Name</label>
                <input type="text" name="name" value={newProduct.name} onChange={handleCreateChange} required placeholder="e.g. Frozen Mackerel"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <select name="category_id" value={newProduct.category_id} onChange={handleCreateChange} required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border bg-white">
                  <option value="">-- Select Category --</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">SKU / Code</label>
                <input type="text" name="sku" value={newProduct.sku} onChange={handleCreateChange} required placeholder="e.g. FISH-001"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border uppercase font-mono" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                 {/*<div>
                    <label className="block text-sm font-medium text-gray-700">Cost Price (₦)</label>
                    <input type="number" name="cost_price" value={newProduct.cost_price} onChange={handleCreateChange} required placeholder="0.00"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
                 </div>*/}
                 <div>
                    <label className="block text-sm font-medium text-gray-700">Selling Price (₦)</label>
                    <input type="number" name="selling_price" value={newProduct.selling_price} onChange={handleCreateChange} required placeholder="0.00"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
                 </div>
              </div>
            </div>

            {/* --- RIGHT COLUMN: CONFIGURATION --- */}
            <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
              
              <div>
                 <label className="block text-sm font-medium text-gray-700">Base Unit Type</label>
                 <select name="unit_type" value={newProduct.unit_type} onChange={handleCreateChange} 
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border bg-white">
                    <option value="Unit">Unit / Piece</option>
                    <option value="Weight">Weight (Kg)</option>
                    <option value="Carton">Carton</option>
                 </select>
              </div>

              {/* TOGGLE SWITCH */}
              <div className="flex items-center space-x-3 py-2">
                <input 
                  id="has_sub_unit"
                  name="has_sub_unit" 
                  type="checkbox" 
                  checked={newProduct.has_sub_unit} 
                  onChange={handleCreateChange}
                  className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" 
                />
                <label htmlFor="has_sub_unit" className="text-sm font-medium text-gray-900 select-none cursor-pointer">
                    This product has sub-units? <span className="text-gray-500 font-normal">(e.g. Carton contains 10kg)</span>
                </label>
              </div>

              {/* CONDITIONAL FIELDS */}
              {newProduct.has_sub_unit && (
                  <div className="space-y-4 animate-fade-in-down border-l-2 border-blue-400 pl-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Sub-Unit Ratio</label>
                        <input type="number" name="sub_unit_ratio" value={newProduct.sub_unit_ratio} onChange={handleCreateChange} min="0.01" step="0.01"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
                        <p className="text-xs text-gray-500 mt-1">If 1 Carton = 10 Units, enter 10.</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Attributes (JSON)</label>
                        <textarea name="attributesStr" value={newProduct.attributesStr} onChange={handleCreateChange} rows={3}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border font-mono text-xs" 
                        placeholder='{"brand": "Oritse", "storage_temp": "-18C"}'></textarea>
                      </div>
                  </div>
              )}
            </div>

            <div className="md:col-span-2 flex justify-end pt-4 border-t border-gray-100">
              <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white px-8 py-2.5 rounded-md font-semibold hover:bg-blue-700 disabled:opacity-50">
                {isSubmitting ? 'Saving...' : 'Save Product Definition'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- LIST TABLE --- */}
      <div className="bg-white border border-gray-200 rounded-lg shadow overflow-hidden">
        {isLoading ? (
            <div className="p-10 text-center text-gray-500">Loading catalog...</div>
        ) : (
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prices</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Config</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {products.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{p.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{p.sku}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <div><span className="text-gray-500 text-xs">Cost:</span> ₦{Number(p.cost_price).toLocaleString()}</div>
                                
                                {/* --- INLINE EDITABLE PRICE COMPONENT --- */}
                                <EditablePriceCell 
                                  productId={p.id} 
                                  initialPrice={p.selling_price} 
                                  onSuccess={(newPrice) => {
                                    // Update the specific product in the table seamlessly
                                    setProducts(prevProducts => 
                                      prevProducts.map(prod => 
                                        prod.id === p.id ? { ...prod, selling_price: newPrice } : prod
                                      )
                                    );
                                  }} 
                                />

                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                               {p.has_sub_unit ? (
                                   <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                                       Has Sub-Units (1:{p.sub_unit_ratio})
                                   </span>
                               ) : (
                                   <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                                       Simple {p.unit_type}
                                   </span>
                               )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        )}
      </div>
    </div>
  );
};

export default ProductList;