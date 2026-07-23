import React, { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';

// --- Interfaces ---
export interface Payment {
  id: string | number;
  transaction_type: 'Sales' | 'Debt Payment' | 'Refund';
  method: string;
  amount: string | number;
  reference_code: string | null;
  customer_name: string | null; 
  branch_name: string | null;
  processed_by_name: string | null;
  formatted_date: string; // Assuming your TenantAwareModel includes a timestamp
}

interface Branch {
  id: string | number;
  name: string;
}

const SalesPayments: React.FC = () => {
  // --- Global Auth State ---
  const userRole = localStorage.getItem('userRole');
  const localBranchId = localStorage.getItem('branchId');
  const isAdmin = userRole === 'Tenant_Admin' || userRole === 'ADMIN' || userRole === 'Super_Admin';

  // --- Data State ---
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Filters & Search State ---
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filterBranchId, setFilterBranchId] = useState<string | number>(isAdmin ? '' : (localBranchId || ''));
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchCustomer, setSearchCustomer] = useState('');

  // --- Pagination State ---
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);

  // 1. Fetch Branches (Admins Only)
  useEffect(() => {
    if (isAdmin) {
      const fetchBranches = async () => {
        try {
          const res = await api.get('/branches/');
          setBranches(res.data);
        } catch (err) {
          console.error("Failed to fetch branches:", err);
        }
      };
      fetchBranches();
    }
  }, [isAdmin]);

  // 2. Fetch Payments Logic
  const fetchPayments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Adjust this endpoint to match your Django URL routing
      const response = await api.get('/sales/sales-payments/', {
        params: { 
          page: currentPage, 
          search: searchCustomer, // Backend should filter Customer name using this
          branch_id: filterBranchId || undefined,
          start_date: startDate || undefined, // Send start date
          end_date: endDate || undefined      // Send end date
        }
      });

      const data = response.data;
      const fetchedPayments = data.results ? data.results : (Array.isArray(data) ? data : []);

      setHasNext(!!data.next);
      setHasPrev(!!data.previous);
      setPayments(fetchedPayments);
    } catch (err: any) {
      console.error("Failed to fetch payments:", err);
      setError(err.response?.data?.message || err.response?.data?.detail || "Failed to load payment records.");
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Debounce fetch on search, page, or filter changes
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchPayments();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchCustomer, startDate, endDate, currentPage, filterBranchId]); 

  // 4. Reset to page 1 ONLY when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchCustomer, filterBranchId, startDate, endDate]);

  // Helper for Transaction Type Badges
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'Sales':
        return <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full bg-green-100 text-green-800 border border-green-200">Sales</span>;
      case 'Debt Payment':
        return <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full bg-blue-100 text-blue-800 border border-blue-200">Debt Payment</span>;
      case 'Refund':
        return <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full bg-red-100 text-red-800 border border-red-200">Refund</span>;
      default:
        return <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full bg-gray-100 text-gray-800 border border-gray-200">{type}</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 relative">
      
      {/* HEADER & FILTERS */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div className="w-full xl:w-auto shrink-0">
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">Payments Ledger</h2>
          <p className="text-sm text-gray-500">Track all sales, debt repayments, and refunds.</p>
        </div>
        
        <div className="flex flex-wrap w-full xl:w-auto gap-3 items-center justify-start xl:justify-end">
          
          {/* Start and End Date Filters */}
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-bold uppercase">From</span>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full sm:w-auto p-2.5 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-700 bg-gray-50 cursor-pointer"
                title="Start Date"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-bold uppercase">To</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full sm:w-auto p-2.5 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-700 bg-gray-50 cursor-pointer"
                title="End Date"
              />
            </div>
          </div>

          {/* Branch Filter (Admins Only) */}
          {isAdmin && (
            <select 
              value={filterBranchId}
              onChange={(e) => setFilterBranchId(e.target.value)}
              className="w-full sm:w-auto p-3 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-gray-50 cursor-pointer"
            >
              <option value="">All Branches</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          )}

          {/* Customer Search Input*/}
          <div className="relative w-full sm:w-72 flex-grow sm:flex-grow-0">
            <input 
              type="text" 
              placeholder="Search customer name..." 
              value={searchCustomer}
              onChange={(e) => setSearchCustomer(e.target.value)}
              className="w-full p-3 pl-10 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow font-medium text-sm"
            />
            <span className="absolute left-3 top-3.5 text-gray-400 text-sm">🔍</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-sm">
          <p className="font-bold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* DATA TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex justify-center items-center h-64 text-gray-500">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
             Loading payment records...
          </div>
        ) : (
          <div className="overflow-x-auto flex-1">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Reference & Date</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Customer & Branch</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Method & Processed By</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-medium">
                      {(searchCustomer || startDate || endDate || filterBranchId) 
                        ? 'No matching payments found for the selected filters.' 
                        : 'No payment records available.'}
                    </td>
                  </tr>
                ) : (
                  payments.map((payment) => (
                    <tr 
                      key={payment.id} 
                      className="hover:bg-blue-50/50 transition-colors group"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {payment.reference_code || `#PAY-${String(payment.id).padStart(5, '0')}`}
                        </div>
                        <div className="text-xs text-gray-500">
                          {payment.formatted_date ? new Date(payment.formatted_date).toLocaleString() : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">{payment.customer_name || 'Walk-in / Unknown'}</div>
                        <div className="text-xs text-gray-500">{payment.branch_name || 'No Branch'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                         <div className="text-sm font-medium text-gray-800">{payment.method}</div>
                         <div className="text-xs text-gray-500">By: {payment.processed_by_name || 'System'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {getTypeBadge(payment.transaction_type)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className={`text-sm font-black ${payment.transaction_type === 'Refund' ? 'text-red-600' : 'text-gray-900'}`}>
                          {payment.transaction_type === 'Refund' ? '- ' : ''}₦{Number(payment.amount).toLocaleString()}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION FOOTER */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <span className="text-sm text-gray-500 font-medium">
                Page <span className="font-bold text-gray-900">{currentPage}</span>
            </span>
            <div className="flex space-x-2">
                <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={!hasPrev || isLoading}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    Previous
                </button>
                <button
                    onClick={() => setCurrentPage(p => p + 1)}
                    disabled={!hasNext || isLoading}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    Next
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SalesPayments;