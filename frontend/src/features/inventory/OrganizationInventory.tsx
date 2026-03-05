import React, { useState, useEffect } from 'react';
import api from '../../api/axiosInstance'; // Adjust path as needed

// --- Interfaces matching your exact Django JSON payload ---
interface BranchBreakdown {
  branch_id: string;
  branch_name: string;
  stock: number;
}

interface OrganizationStock {
  product_id: string;
  product_name: string;
  total_organization_stock: number;
  branch_breakdown: BranchBreakdown[];
}

const OrganizationInventory: React.FC = () => {
  const [inventory, setInventory] = useState<OrganizationStock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Keep track of which product rows are expanded to show branch details
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

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4">
      
      {/* HEADER & SEARCH */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">Organization Inventory</h2>
          <p className="text-sm text-gray-500">Global stock overview and branch allocations.</p>
        </div>
        
        <div className="w-full md:w-1/3">
          <input 
            type="text" 
            placeholder="Search products..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-3 pl-4 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow font-medium text-sm"
          />
        </div>
      </div>

      {/* ERROR MESSAGE */}
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
             Loading global inventory...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-12"></th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Product Name</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Total Org Stock</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-gray-400 font-medium">
                      No products found matching "{searchTerm}"
                    </td>
                  </tr>
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
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <svg 
                              className={`w-5 h-5 text-gray-400 group-hover:text-blue-500 transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} 
                              fill="none" viewBox="0 0 24 24" stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                            </svg>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                            {item.product_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                            <span className="font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                              {Number(item.total_organization_stock).toLocaleString()}
                            </span>
                          </td>
                        </tr>

                        {/* EXPANDED BRANCH BREAKDOWN ROW */}
                        {isExpanded && (
                          <tr className="bg-gray-50/80 border-b border-gray-100">
                            <td></td>
                            <td colSpan={2} className="px-6 py-4">
                              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
                                <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                                  <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Branch Allocation</span>
                                </div>
                                <div className="divide-y divide-gray-100">
                                  {item.branch_breakdown.length === 0 ? (
                                    <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                      No stock distributed to branches yet.
                                    </div>
                                  ) : (
                                    item.branch_breakdown.map((branch) => (
                                      <div key={branch.branch_id} className="flex justify-between items-center px-4 py-3 hover:bg-gray-50">
                                        <div className="flex items-center gap-2">
                                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                                          <span className="text-sm font-medium text-gray-700">{branch.branch_name}</span>
                                        </div>
                                        <span className="text-sm font-bold text-gray-900">
                                          {Number(branch.stock).toLocaleString()}
                                        </span>
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