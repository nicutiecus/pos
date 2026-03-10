import React, { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';

// --- Interfaces ---
export interface InventoryBatch {
  id: string | number;
  batch_number: string;
  product_name: string;
  branch_name: string;
  initial_quantity: number;
  quantity_on_hand: number; // Updated key
  cost_price_at_receipt: number | string; // Added key
  created_at: string; // Updated key
  expiry_date: string | null;
  supplier_name?: string;
}

const InventoryBatches: React.FC = () => {
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VALID' | 'EXPIRING_SOON' | 'EXPIRED'>('ALL');

  useEffect(() => {
    const fetchBatches = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await api.get('/inventory/batches/');
        setBatches(response.data);
      } catch (err: any) {
        console.error("Failed to fetch inventory batches:", err);
        setError(err.response?.data?.message || "Failed to load batch data.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBatches();
  }, []);

  // --- Helper to determine expiry status dynamically ---
  const getExpiryStatus = (expiryDate: string | null) => {
    if (!expiryDate) return { label: 'No Expiry', color: 'bg-gray-100 text-gray-700' };
    
    const today = new Date();
    const expDate = new Date(expiryDate);
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: 'Expired', color: 'bg-red-100 text-red-800', isExpired: true };
    if (diffDays <= 30) return { label: `Expires in ${diffDays}d`, color: 'bg-orange-100 text-orange-800', isExpiringSoon: true };
    return { label: 'Valid', color: 'bg-green-100 text-green-800', isValid: true };
  };

  // --- Filter Logic ---
  const filteredBatches = batches.filter(batch => {
    // 1. Text Search
    const matchesSearch = 
      batch.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      batch.batch_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      batch.branch_name.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // 2. Status Filter
    const status = getExpiryStatus(batch.expiry_date);
    if (statusFilter === 'EXPIRED' && !status.isExpired) return false;
    if (statusFilter === 'EXPIRING_SOON' && !status.isExpiringSoon) return false;
    if (statusFilter === 'VALID' && !status.isValid && batch.expiry_date) return false;

    return true;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4">
      
      {/* HEADER & FILTERS */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">Batch Management</h2>
          <p className="text-sm text-gray-500">Track stock by batch numbers, cost prices, and expiration dates.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="p-3 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-sm bg-white"
          >
            <option value="ALL">All Batches</option>
            <option value="VALID">Valid Stock</option>
            <option value="EXPIRING_SOON">Expiring Soon (&lt;30 days)</option>
            <option value="EXPIRED">Expired</option>
          </select>

          <input 
            type="text" 
            placeholder="Search product, branch, or batch #..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-64 p-3 pl-4 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow font-medium text-sm"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-sm">
          <p className="font-bold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* DATA TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center h-64 text-gray-500">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
             Loading batch data...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Batch #</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Product & Branch</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Stock Level</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Cost Price</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Dates</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredBatches.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400 font-medium">
                      No batches found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredBatches.map((batch) => {
                    const status = getExpiryStatus(batch.expiry_date);
                    const isDepleted = batch.quantity_on_hand <= 0; // Updated to use quantity_on_hand

                    return (
                      <tr key={batch.id} className={`hover:bg-blue-50/50 transition-colors ${isDepleted ? 'opacity-60 bg-gray-50' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded border border-gray-200">
                            {batch.batch_number}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-gray-900">{batch.product_name}</div>
                          <div className="text-xs text-gray-500">{batch.branch_name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className={`text-sm font-black ${isDepleted ? 'text-red-500' : 'text-blue-600'}`}>
                            {batch.quantity_on_hand} <span className="text-xs text-gray-400 font-normal">/ {batch.initial_quantity}</span>
                          </div>
                          {isDepleted && <div className="text-[10px] font-bold text-red-500 uppercase mt-1">Depleted</div>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-700">
                          ₦{Number(batch.cost_price_at_receipt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          <div>
                            <span className="text-gray-400 text-xs uppercase font-bold mr-1">Rcvd:</span> 
                            {/* Updated to created_at */}
                            {batch.created_at ? new Date(batch.created_at).toLocaleDateString() : 'Unknown'}
                          </div>
                          {batch.expiry_date && (
                            <div><span className="text-gray-400 text-xs uppercase font-bold mr-1">Exp:</span> {new Date(batch.expiry_date).toLocaleDateString()}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`px-3 py-1 text-xs font-bold rounded-full ${status.color}`}>
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryBatches;