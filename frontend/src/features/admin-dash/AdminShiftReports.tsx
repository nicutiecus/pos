import React, { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';

// --- Interfaces ---
export interface AdminShiftReport {
  id: string | number;
  shift_code: string;
  branch_name: string;
  cashier_name: string;
  formatted_start_time: string;
  formatted_end_time: string;
  order_count: number;
  total_revenue: number;
  expected_cash: number;
  declared_cash: number;
  variance: number;
}

const AdminShiftReports: React.FC = () => {
  const [shifts, setShifts] = useState<AdminShiftReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);

  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // --- Debounce Effect ---
  // Waits 500ms after the user stops typing before locking in the search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // --- Reset Page on New Search ---
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);

  // --- Fetch Data Effect ---
  useEffect(() => {
    const fetchShifts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Send BOTH the page number and the search term to Django
        const response = await api.get('/sales/reports/closed-shift', {
            params: { 
                page: currentPage,
                search: debouncedSearchTerm // DRF's default parameter for SearchFilter
            }
        });

        const data = response.data;
        
        // Extract array from DRF's paginated shape
        const closedShifts = data.results ? data.results : (Array.isArray(data) ? data : []);

        setHasNext(!!data.next);
        setHasPrev(!!data.previous);

        // Sort current page by newest first
        const sortedShifts = [...closedShifts].filter(Boolean).sort((a, b) => {
            const dateA = new Date(a.formatted_end_time || a.formatted_start_time).getTime();
            const dateB = new Date(b.formatted_end_time || b.formatted_start_time).getTime();
            return dateB - dateA; 
        });

        setShifts(sortedShifts);
      } catch (err: any) {
        console.error("Failed to fetch shift reports:", err);
        setError(err.response?.data?.message || err.response?.data?.detail || "Failed to load shift data.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchShifts();
  }, [currentPage, debouncedSearchTerm]); // Re-run whenever page OR debounced search changes

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4">
      
      {/* HEADER & FILTERS */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">Closed Shift Reports</h2>
          <p className="text-sm text-gray-500">Audit historical shift reconciliations and cash variances.</p>
        </div>
        
        <div className="flex w-full md:w-auto">
          <input 
            type="text" 
            placeholder="Search entire database..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-80 p-3 pl-4 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow font-medium text-sm"
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex justify-center items-center h-64 text-gray-500">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
             Loading database records...
          </div>
        ) : (
          <div className="overflow-x-auto flex-1">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Shift Details</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Timeframe</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Sales Data</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Cash Reconciled</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {shifts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400 font-medium">
                      {debouncedSearchTerm ? 'No matching shift reports found.' : 'No shift reports available.'}
                    </td>
                  </tr>
                ) : (
                  // Notice we map directly over 'shifts' now, not 'filteredShifts'
                  shifts.map((shift) => {
                    let varianceColor = "text-green-600 font-bold";
                    let varianceLabel = "Perfect Match";
                    
                    if (shift.variance < 0) {
                        varianceColor = "text-red-600 font-bold";
                        varianceLabel = `Short: ₦${Math.abs(shift.variance).toLocaleString()}`;
                    } else if (shift.variance > 0) {
                        varianceColor = "text-orange-500 font-bold";
                        varianceLabel = `Over: +₦${shift.variance.toLocaleString()}`;
                    }

                    return (
                      <tr key={shift.id} className="hover:bg-blue-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-gray-900">{shift.cashier_name}</div>
                          <div className="text-xs font-medium text-gray-500 mb-1">{shift.branch_name}</div>
                          <span className="text-[10px] text-gray-400 uppercase tracking-wider border border-gray-200 rounded px-1.5 py-0.5 bg-gray-50">
                            ID: {shift.shift_code ? shift.shift_code.slice(0, 8) : 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          <div><span className="text-green-600 font-bold mr-1">In:</span> {new Date(shift.formatted_start_time).toLocaleString()}</div>
                          <div><span className="text-red-500 font-bold mr-1">Out:</span> {new Date(shift.formatted_end_time).toLocaleString()}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="text-sm font-black text-blue-700">₦{Number(shift.total_revenue).toLocaleString()}</div>
                          <div className="text-xs text-gray-500">{shift.order_count} Orders</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm text-gray-700">
                            Exp: ₦{Number(shift.expected_cash).toLocaleString()}
                          </div>
                          <div className="text-sm font-bold text-gray-900">
                              Decl: ₦{Number(shift.declared_cash).toLocaleString()}
                          </div>
                          <div className={`text-[10px] mt-1 uppercase tracking-wider ${varianceColor}`}>
                              {varianceLabel}
                          </div>
                        </td>
                      </tr>
                    );
                  })
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

export default AdminShiftReports;