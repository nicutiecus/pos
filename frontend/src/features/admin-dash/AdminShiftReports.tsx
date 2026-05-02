// AdminShiftReports.tsx
import React, { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';
import { OpenShiftsModal } from './OpenShiftsModal'; // Adjust import path as needed

export interface AdminShiftReport {
  id: string | number;
  shift_code: string;
  branch_name: string;
  cashier_name: string;
  formatted_start_time: string;
  formatted_end_time: string;
  order_count: number;
  expected_pos: number;
  expected_transfer: number;
  total_revenue: number;
  expected_cash: number;
  declared_cash: number;
  variance: number;
  notes: string;
}

const AdminShiftReports: React.FC = () => {
  // --- Auth & Role State ---
  const userRole = localStorage.getItem('userRole');
  const localBranchId = localStorage.getItem('branchId');
  const isAdmin = userRole === 'Tenant_Admin' || userRole === 'ADMIN';

  const [shifts, setShifts] = useState<AdminShiftReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Search State
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // --- Modal State ---
  const [selectedShiftId, setSelectedShiftId] = useState<string | number | null>(null);
  const [shiftDetails, setShiftDetails] = useState<any | null>(null);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [isOpenShiftsModalOpen, setIsOpenShiftsModalOpen] = useState(false);

  // Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);

  // Fetch Table Data (Closed Shifts)
  useEffect(() => {
    const fetchShifts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await api.get('/sales/reports/closed-shift', {
            params: { page: currentPage, search: debouncedSearchTerm }
        });

        const data = response.data;
        const closedShifts = data.results ? data.results : (Array.isArray(data) ? data : []);

        setHasNext(!!data.next);
        setHasPrev(!!data.previous);

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
  }, [currentPage, debouncedSearchTerm]);

  // Fetch Individual Shift Details (Closed Shifts)
  useEffect(() => {
    if (!selectedShiftId) {
      setShiftDetails(null);
      return;
    }

    const fetchDetails = async () => {
      setIsModalLoading(true);
      setModalError(null);
      try {
        const response = await api.get(`/sales/reports/closed-shift/${selectedShiftId}/`);
        setShiftDetails(response.data);
      } catch (err: any) {
        console.error("Failed to fetch shift details:", err);
        setModalError(err.response?.data?.message || err.response?.data?.detail || "Failed to load shift details.");
      } finally {
        setIsModalLoading(false);
      }
    };

    fetchDetails();
  }, [selectedShiftId]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 relative">
      
      {/* HEADER & FILTERS */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">Closed Shift Reports</h2>
          <p className="text-sm text-gray-500">Audit historical shift reconciliations and cash variances.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3">
          <button 
            onClick={() => setIsOpenShiftsModalOpen(true)}
            className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold px-4 py-3 rounded-lg shadow-sm transition-colors whitespace-nowrap flex items-center justify-center gap-2"
          >
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            Active Shifts
          </button>

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

      {/* DATA TABLE (Closed Shifts) */}
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
                      <tr 
                        key={shift.id} 
                        onClick={() => setSelectedShiftId(shift.id)} 
                        className="hover:bg-blue-50/50 transition-colors cursor-pointer"
                      >
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

      {/* RENDER THE EXTRACTED OPEN SHIFTS MODAL */}
      <OpenShiftsModal 
        isOpen={isOpenShiftsModalOpen} 
        onClose={() => setIsOpenShiftsModalOpen(false)} 
        isAdmin={isAdmin} 
        localBranchId={localBranchId} 
      />

      {/* DYNAMIC SHIFT DETAILS MODAL (Closed Shifts) */}
      {selectedShiftId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up">
            
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-lg font-black text-gray-800">Shift Details</h3>
                {shiftDetails && (
                   <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">ID: {shiftDetails.shift_code}</p>
                )}
              </div>
              <button 
                onClick={() => setSelectedShiftId(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              {isModalLoading ? (
                 <div className="flex flex-col items-center justify-center text-gray-500 space-y-3">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                    <p>Fetching full shift record...</p>
                 </div>
              ) : modalError ? (
                 <div className="bg-red-50 text-red-700 p-4 rounded text-center border border-red-100">
                    <p className="font-bold mb-1">Error Loading Data</p>
                    <p className="text-sm">{modalError}</p>
                 </div>
              ) : shiftDetails ? (
                 <div className="space-y-6">
                    {/* User Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">Cashier</p>
                        <p className="font-bold text-gray-900">{shiftDetails.cashier_name}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">Branch</p>
                        <p className="font-bold text-gray-900">{shiftDetails.branch_name}</p>
                        </div>
                    </div>

                    {/* Times */}
                    <div className="border-t border-b border-gray-100 py-4 space-y-2">
                        <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Clock In:</span>
                        <span className="font-medium text-gray-900">{new Date(shiftDetails.formatted_start_time).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Clock Out:</span>
                        <span className="font-medium text-gray-900">{new Date(shiftDetails.formatted_end_time).toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Financials */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Total Revenue:</span>
                        <span className="font-bold text-blue-600">₦{Number(shiftDetails.total_revenue).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Total Orders:</span>
                        <span className="font-medium text-gray-900">{shiftDetails.order_count}</span>
                        </div>
                        
                        <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Expected Transfer:</span>
                        <span className="font-medium text-gray-900">₦{Number(shiftDetails.expected_transfer).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Expected POS:</span>
                        <span className="font-medium text-gray-900">₦{Number(shiftDetails.expected_pos).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Expected Cash:</span>
                        <span className="font-medium text-gray-900">₦{Number(shiftDetails.expected_cash).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Declared Cash:</span>
                        <span className="font-medium text-gray-900">₦{Number(shiftDetails.declared_cash).toLocaleString()}</span>
                        </div>

                        {/* Variance Highlight */}
                        <div className={`mt-4 p-4 rounded-lg flex justify-between items-center font-bold ${
                        shiftDetails.variance < 0 ? 'bg-red-50 text-red-700 border border-red-100' : 
                        shiftDetails.variance > 0 ? 'bg-orange-50 text-orange-700 border border-orange-100' : 
                        'bg-green-50 text-green-700 border border-green-100'
                        }`}>
                        <span>Variance</span>
                        <span>
                            {shiftDetails.variance > 0 ? '+' : ''}₦{Number(shiftDetails.variance).toLocaleString()}
                        </span>
                        </div>

                        <div className="mt-6 pt-4 border-t border-gray-100">
                          <h4 className="text-sm font-bold text-gray-800 mb-2">Cashier Notes</h4>
                          <div className="bg-white border border-gray-200 rounded-lg p-4 max-h-32 overflow-y-auto text-sm text-gray-700 whitespace-pre-wrap leading-relaxed shadow-inner">
                            {shiftDetails.notes ? (
                              shiftDetails.notes
                            ) : (
                              <span className="text-gray-400 italic">No notes provided for this shift.</span>
                            )}
                          </div>
                        </div>
                    </div>
                 </div>
              ) : null}
            </div>

            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 shrink-0">
              <button 
                onClick={() => setSelectedShiftId(null)}
                className="w-full bg-white border border-gray-300 text-gray-700 font-bold py-2.5 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
              >
                Close Details
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default AdminShiftReports;