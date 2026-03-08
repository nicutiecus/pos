import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axiosInstance';

interface ProductOption {
  id: string | number;
  name: string;
  total_quantity: number;
}

interface BranchOption {
  id: string | number;
  name: string;
}

const StockRemoval: React.FC = () => {
  const navigate = useNavigate();
  
  // --- Role & Auth Checks ---
  const userRole = localStorage.getItem('userRole');
  const isAdmin = userRole === 'Tenant_Admin' || 
                  userRole?.toLowerCase() === 'admin' || 
                  userRole?.toLowerCase() === 'tenant_admin' ||
                  userRole?.toLowerCase() === 'superuser';
                  
  const defaultBranchId = localStorage.getItem('branchId') || '';

  // --- State ---
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [selectedBranchId, setSelectedBranchId] = useState(isAdmin ? '' : defaultBranchId);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('Damaged');
  const [notes, setNotes] = useState('');

  // 1. Fetch branches IF the user is an Admin
  useEffect(() => {
    if (isAdmin) {
      const fetchBranches = async () => {
        try {
          const res = await api.get('/branches'); // Assuming this is your standard branch endpoint
          setBranches(res.data);
        } catch (err) {
          console.error("Failed to load branches:", err);
          setError("Failed to load available branches for the organization.");
        }
      };
      fetchBranches();
    }
  }, [isAdmin]);

  // 2. Fetch products dynamically based on the CURRENTLY selected branch
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await api.get(`/inventory/levels/${selectedBranchId}`);
        setProducts(res.data);
      } catch (err) {
        console.error("Failed to load products:", err);
        setError("Failed to load inventory for this branch. Please try again.");
        setProducts([]); // Clear out products on fail to prevent accidental removal
      }
    };

    if (selectedBranchId) {
      fetchProducts();
    } else {
      setProducts([]); // If no branch is selected yet, clear the product list
    }
  }, [selectedBranchId]);

  // Handler for Admin changing branches
  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBranchId(e.target.value);
    setSelectedProductId(''); // Reset the product selection so they don't accidentally submit an old product ID
    setQuantity('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedBranchId) {
      setError("A branch must be selected.");
      return;
    }
    
    if (!selectedProductId || !quantity || Number(quantity) <= 0) {
      setError("Please select a product and enter a valid quantity.");
      return;
    }

    setIsLoading(true);
    setError(null);

    // Exact payload requested
    const payload = {
      product_id: selectedProductId,
      branch_id: selectedBranchId,
      quantity: quantity.toString(), 
      reason: reason,
      notes: notes
    };

    try {
      await api.post('/inventory/remove/', payload);
      alert('Stock successfully removed.');
      navigate('/admin/inventory'); 
    } catch (err: any) {
      console.error("Removal failed:", err);
      setError(err.response?.data?.message || "Failed to remove stock.");
    } finally {
      setIsLoading(false);
    }
  };

  const selectedProductDetails = products.find(p => p.id.toString() === selectedProductId);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-2xl font-black text-gray-900 mb-2">Remove Stock</h2>
        <p className="text-sm text-gray-500 mb-6">Log damaged, expired, or missing inventory to keep stock levels accurate.</p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 border-l-4 border-red-500 rounded text-sm font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
          
          {/* --- BRANCH SELECTION LOGIC --- */}
          <div className="p-4 bg-gray-50 border border-gray-100 rounded-lg mb-6">
             <label className="block text-sm font-bold text-gray-700 mb-2">Operating Branch <span className="text-red-500">*</span></label>
             {isAdmin ? (
               <select 
                 value={selectedBranchId}
                 onChange={handleBranchChange}
                 className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-800 font-medium"
                 required
               >
                 <option value="" disabled>-- Select a Branch to operate in --</option>
                 {branches.map(b => (
                   <option key={b.id} value={b.id}>{b.name}</option>
                 ))}
               </select>
             ) : (
               <input 
                 type="text" 
                 value="Your Assigned Branch (Locked)" 
                 disabled 
                 className="w-full p-3 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 font-medium cursor-not-allowed"
               />
             )}
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Select Product <span className="text-red-500">*</span></label>
            <select 
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              disabled={!selectedBranchId} // Lock product selection until a branch is picked
              className={`w-full p-3 border border-gray-300 rounded-lg outline-none text-gray-800 ${
                !selectedBranchId ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'bg-white focus:ring-2 focus:ring-blue-500'
              }`}
              required
            >
              <option value="" disabled>-- Choose a product --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (Avail: {p.total_quantity})
                </option>
              ))}
            </select>
            {selectedProductDetails && (
              <p className="mt-2 text-xs font-bold text-blue-600">
                Currently available in branch: {selectedProductDetails.total_quantity}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Quantity to Remove <span className="text-red-500">*</span></label>
              <input 
                type="number"
                step="any"
                min="0.1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={!selectedProductId} // Lock quantity until a product is picked
                className={`w-full p-3 border border-gray-300 rounded-lg outline-none ${
                  !selectedProductId ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'focus:ring-2 focus:ring-red-500'
                }`}
                placeholder="e.g. 2.5"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Reason</label>
              <select 
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none bg-white"
              >
                <option value="Damaged">Damaged</option>
                <option value="Expired">Expired</option>
                <option value="Lost/Stolen">Lost / Stolen</option>
                <option value="Internal Use">Internal Use</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Notes / Explanation</label>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none h-24"
              placeholder="e.g. Forklift punctured the carton..."
              required
            />
          </div>

          <div className="pt-4 flex justify-end gap-4 border-t border-gray-100">
            <button 
              type="button" 
              onClick={() => navigate('/admin/inventory')}
              className="px-6 py-3 font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isLoading || !selectedBranchId || !selectedProductId}
              className="px-8 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2"
            >
              {isLoading ? 'Processing...' : 'Confirm Removal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StockRemoval;