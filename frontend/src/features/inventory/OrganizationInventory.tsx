import React, { useState, useEffect } from 'react';
import api from '../../api/axiosInstance'; 

// --- Interfaces ---
// Ensure your Django backend is serializing these value fields!
interface BranchBreakdown {
  branch_id: string;
  branch_name: string;
  stock: number;
  stock_value?: number; // --- NEW: Value at this specific branch ---
}

interface OrganizationStock {
  product_id: string;
  product_name: string;
  total_organization_stock: number;
  total_organization_value: number; // --- NEW: Total value across all branches ---
  branch_breakdown: BranchBreakdown[];
}

const OrganizationInventory: React.FC = () => {
  const [inventory, setInventory] = useState<OrganizationStock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchOrganizationInventory = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await api.get('/inventory/levels/organization');
        setInventory(response.data);
      } catch (err: any) {
        console.error("Failed to fetch organization inventory:", err);
        setError(err.response?.data?.message || "Failed to load inventory data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrganizationInventory();
  }, []);

  const toggleRow = (productId: string) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(productId)) {
      newExpandedRows.delete(productId);
    } else {
      newExpandedRows.add(productId);
    }
    setExpandedRows(newExpandedRows);
  };

  const filteredInventory = inventory.filter(item =>
    item.product_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- NEW: Calculate Grand Total Value ---
  const grandTotalValue = inventory.reduce((sum, item) => sum + Number(item.total_organization_value || 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* HEADER & GLOBAL METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-center">
            <h1 className="text-2xl font-bold text-gray-800">Organization Inventory</h1>
            <p className="text-sm text-gray-500">Track stock levels and valuation across all branches.</p>
        </div>
        
        {/* --- NEW: Grand Total Value Card --- */}
        <div className="bg-blue-50 p-6 rounded-xl shadow-sm border border-blue-100 flex flex-col justify-center items-center text-center">
            <div className="text-sm font-bold text-blue-800 uppercase tracking-wider mb-1">Total Stock Value</div>
            <div className="text-3xl font-black text-blue-900">
                ₦{grandTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-blue-600 mt-1 font-medium">Across all branches</div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center">
        <div className="relative w-full max-w-md">
            <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
            <input 
                type="text" 
                placeholder="Search products..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {error && (
            <div className="p-4 bg-red-50 text-red-700 border-b border-red-100 text-sm font-medium">
                {error}
            </div>
        )}

        {isLoading ? (
            <div className="p-12 text-center text-gray-500 flex justify-center items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                Loading organization inventory...
            </div>
        ) : (
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="w-10 px-6 py-3"></th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Product Name</th>
                            {/* --- NEW: Value Column Header --- */}
                            <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Total Value (₦)</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Total Stock Quantity</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {filteredInventory.length === 0 ? (
                            <tr><td colSpan={4} className="p-8 text-center text-gray-400">No products found.</td></tr>
                        ) : (
                            filteredInventory.map((item) => {
                                const isExpanded = expandedRows.has(item.product_id);
                                return (
                                    <React.Fragment key={item.product_id}>
                                        {/* MAIN ROW */}
                                        <tr 
                                            onClick={() => toggleRow(item.product_id)}
                                            className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                                        >
                                            <td className="px-6 py-4 text-gray-400 group-hover:text-blue-600 transition-colors">
                                                <svg 
                                                    className={`w-5 h-5 transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} 
                                                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                                                </svg>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-bold text-gray-900">{item.product_name}</div>
                                            </td>
                                            {/* --- NEW: Value Column Data --- */}
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <div className="text-sm font-bold text-gray-700">
                                                    ₦{Number(item.total_organization_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <div className="text-sm font-black text-blue-600 bg-blue-50 inline-flex px-3 py-1 rounded-full">
                                                    {Number(item.total_organization_stock).toLocaleString()}
                                                </div>
                                            </td>
                                        </tr>

                                        {/* EXPANDED BRANCH DETAILS ROW */}
                                        {isExpanded && (
                                            <tr className="bg-gray-50/80">
                                                <td></td>
                                                <td colSpan={3} className="px-6 py-4">
                                                    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
                                                        <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex justify-between">
                                                            <span className="text-xs font-bold text-gray-600 uppercase">Branch Breakdown</span>
                                                            <span className="text-xs font-bold text-gray-600 uppercase">Stock & Value</span>
                                                        </div>
                                                        <div className="divide-y divide-gray-100">
                                                            {item.branch_breakdown.length === 0 ? (
                                                                <div className="px-4 py-3 text-sm text-gray-500 italic">No stock found in any branch.</div>
                                                            ) : (
                                                                item.branch_breakdown.map((branch) => (
                                                                    <div key={branch.branch_id} className="flex justify-between items-center px-4 py-3 hover:bg-blue-50/30 transition-colors">
                                                                        <div className="flex items-center gap-2">
                                                                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                                                                            <span className="text-sm font-medium text-gray-700">{branch.branch_name}</span>
                                                                        </div>
                                                                        
                                                                        <div className="flex items-center gap-6">
                                                                            {/* Branch Value */}
                                                                            <span className="text-sm font-medium text-gray-500">
                                                                                ₦{Number(branch.stock_value || 0).toLocaleString()}
                                                                            </span>
                                                                            {/* Branch Stock */}
                                                                            <span className="text-sm font-bold text-gray-900 w-16 text-right">
                                                                                {Number(branch.stock).toLocaleString()}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
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

export default OrganizationInventory;