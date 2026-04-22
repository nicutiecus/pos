import React, { useEffect, useState } from 'react';
import { type ReturnedGoodsRecord } from '../types/returns';
import { ReturnGoodsModal } from '../pos/ReturnGoodsModal'; // ✅ Modal Imported
import api from '../../api/axiosInstance';

// Define Branch interface for the dropdown
interface Branch {
  id: string | number;
  name: string;
}

export const ReturnedGoodsList: React.FC = () => {
  // --- Global Auth State ---
  const userRole = localStorage.getItem('userRole');
  const localBranchId = localStorage.getItem('branchId');
  const tenantId = localStorage.getItem('tenantId'); 
  const isAdmin = userRole === 'Tenant_Admin' || userRole === 'ADMIN';

  // --- Data State ---
  const [returns, setReturns] = useState<ReturnedGoodsRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false); // ✅ Modal State

  // --- Branch Filter State ---
  const [branches, setBranches] = useState<Branch[]>([]);
  // Defaults to empty string for Admins (showing all branches), or the cashier's specific branch
  const [filterBranchId, setFilterBranchId] = useState<string | number>(isAdmin ? '' : (localBranchId || ''));

  // --- Pagination State ---
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // --- Date Filtering State ---
  const defaultStartDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().split('T')[0];
  const defaultEndDate = new Date().toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);

  // --- Fetch Branches (Admins Only) ---
  useEffect(() => {
    if (isAdmin) {
        const fetchBranches = async () => {
            try {
                const res = await api.get('/branches/'); 
                setBranches(res.data); 
            } catch (error) {
                console.error("Failed to fetch branches:", error);
            }
        };
        fetchBranches();
    }
  }, [isAdmin]);

  // --- Fetch Returned Goods ---
  const fetchReturns = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/returns/process-returns', {
        params: {
          start_date: startDate,
          end_date: endDate,
          branch_id: filterBranchId || undefined, // Send undefined if empty so backend ignores it
          tenant: tenantId,
          page: currentPage
        }
      });
      
      if (response.data && Array.isArray(response.data.results)) {
          setReturns(response.data.results);
          setTotalCount(response.data.count || 0);
          const calculatedPages = Math.ceil((response.data.count || 0) / 10);
          setTotalPages(calculatedPages > 0 ? calculatedPages : 1);
      } else if (Array.isArray(response.data)) {
          setReturns(response.data);
          setTotalCount(response.data.length);
          setTotalPages(1);
      } else {
          setReturns([]); 
          setTotalCount(0);
      }
    } catch (error) {
      console.error('Error fetching returned goods', error);
      setReturns([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, [currentPage]); 

  const handleFilter = () => {
    if (currentPage === 1) {
      fetchReturns();
    } else {
      setCurrentPage(1); 
    }
  };

  return (
    <div className="p-6">
      
      {/* Header and Filter Section */}
      <div className="flex flex-col xl:flex-row xl:justify-between xl:items-end mb-6 gap-4">
        <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-800">Returned Goods History</h2>
            
            {/* ✅ Button to trigger the Modal */}
            <button 
                onClick={() => setIsReturnModalOpen(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-colors text-sm flex items-center gap-2"
            >
                <span>↩️</span> Process Return
            </button>
        </div>
        
        <div className="flex flex-wrap items-end gap-3 bg-white p-3 rounded-lg shadow-sm border border-gray-200">
          
          {/* ✅ Admin Branch Filter */}
          {isAdmin && (
            <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Branch</label>
                <select 
                    value={filterBranchId}
                    onChange={(e) => setFilterBranchId(e.target.value)}
                    className="border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-gray-50 min-w-[150px]"
                >
                    <option value="">All Branches</option>
                    {branches.map(branch => (
                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Start Date</label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">End Date</label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>
          <button 
            onClick={handleFilter}
            className="bg-blue-600 text-white px-5 py-2 rounded font-medium hover:bg-blue-700 transition-colors shadow-sm text-sm h-[38px]"
          >
            Filter
          </button>
        </div>
      </div>
      
      {/* Table Section */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="flex flex-col items-center space-y-3">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
               <p className="text-gray-500 font-medium text-sm">Loading returned goods...</p>
            </div>
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200 flex flex-col">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm text-left">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 font-semibold text-gray-600 uppercase tracking-wider text-xs">Date</th>
                  <th className="px-6 py-3 font-semibold text-gray-600 uppercase tracking-wider text-xs">Receipt ID</th>
                  <th className="px-6 py-3 font-semibold text-gray-600 uppercase tracking-wider text-xs">Refund Amount</th>
                  <th className="px-6 py-3 font-semibold text-gray-600 uppercase tracking-wider text-xs">Reason</th>
                  <th className="px-6 py-3 font-semibold text-gray-600 uppercase tracking-wider text-xs">Cashier</th>
          
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {!Array.isArray(returns) || returns.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      <span className="block text-3xl mb-2">📦</span>
                      No returned goods found for the selected criteria.
                    </td>
                  </tr>
                ) : (
                  returns.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-gray-700 whitespace-nowrap">
                        {new Date(record.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-gray-900 font-medium">
                        RET-{record.id.toString().padStart(4, '0')}
                      </td>
                      
                      {/* Total Refund Amount */}
                      <td className="px-6 py-4 text-gray-900 font-bold text-right">
                        ₦{Number(record.total_refund_amount).toLocaleString()}
                      </td>
                      
                      {/* Reason */}
                      <td className="px-6 py-4 text-gray-500 max-w-sm truncate" title={record.reason}>
                        {record.reason || '-'}
                      </td>

                      <td className="px-6 py-4 text-gray-700">
                        {record.cashier_name ? record.cashier_name : <span className="text-gray-400 italic">Unknown</span>}
                      </td>
                    
      
                      <td className="px-6 py-4">
                        <span 
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${
                            record.condition === 'restockable' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {record.condition}
                        </span>
                      </td>
                      
                      
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalCount > 0 && (
            <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex items-center justify-between">
              <span className="text-sm text-gray-700">
                Showing <span className="font-semibold">{returns.length}</span> of <span className="font-semibold">{totalCount}</span> returns
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ✅ The Modal Component */}
      <ReturnGoodsModal 
        isOpen={isReturnModalOpen} 
        onClose={() => {
            setIsReturnModalOpen(false);
            fetchReturns(); // Optionally refresh the list after a return is processed
        }} 
      />

    </div>
  );
};

export default ReturnedGoodsList