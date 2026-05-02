// OpenShiftsModal.tsx
import React, { useState, useEffect } from 'react';
import api from '../../api/axiosInstance'; // Adjust this import path if you save this file in a different folder

export interface OpenShift {
  id: string | number;
  shift_code: string;
  branch_name: string;
  cashier_name: string;
  formatted_start_time: string;
}

interface OpenShiftsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  localBranchId: string | null;
}

export const OpenShiftsModal: React.FC<OpenShiftsModalProps> = ({ 
  isOpen, 
  onClose, 
  isAdmin, 
  localBranchId 
}) => {
  const [openShifts, setOpenShifts] = useState<OpenShift[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only fetch when the modal actually opens
    if (isOpen) {
      const fetchOpenShifts = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const params = isAdmin ? {} : { branch_id: localBranchId };
          const response = await api.get('/sales/reports/open-shift', { params });
          
          const data = response.data.results ? response.data.results : (Array.isArray(response.data) ? response.data : []);
          setOpenShifts(data);
        } catch (err: any) {
          console.error("Failed to fetch open shifts:", err);
          setError(err.response?.data?.message || err.response?.data?.detail || "Failed to load open shifts.");
        } finally {
          setIsLoading(false);
        }
      };

      fetchOpenShifts();
    } else {
        // Clear data when modal closes so it doesn't flash old data on next open
        setOpenShifts([]);
    }
  }, [isOpen, isAdmin, localBranchId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-down">
        
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              Currently Active Shifts
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {isAdmin ? 'Showing open shifts across all branches.' : 'Showing open shifts for your branch.'}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-0 flex-1 overflow-y-auto">
          {isLoading ? (
             <div className="flex flex-col items-center justify-center h-64 text-gray-500 space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p>Scanning active shifts...</p>
             </div>
          ) : error ? (
             <div className="m-6 bg-red-50 text-red-700 p-4 rounded text-center border border-red-100">
                <p className="font-bold mb-1">Error Loading Data</p>
                <p className="text-sm">{error}</p>
             </div>
          ) : openShifts.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <span className="text-4xl mb-3">📭</span>
                <p>No shifts are currently open.</p>
             </div>
          ) : (
             <table className="min-w-full divide-y divide-gray-200">
               <thead className="bg-white sticky top-0 shadow-sm z-10">
                 <tr>
                   <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Cashier</th>
                   <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Branch</th>
                   <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Clocked In At</th>
                 </tr>
               </thead>
               <tbody className="bg-white divide-y divide-gray-100">
                 {openShifts.map((shift) => (
                   <tr key={shift.id} className="hover:bg-blue-50/50 transition-colors">
                     <td className="px-6 py-4 whitespace-nowrap">
                       <div className="text-sm font-bold text-gray-900">{shift.cashier_name}</div>
                       <div className="text-xs text-gray-400 mt-0.5">ID: {shift.shift_code ? shift.shift_code.slice(0, 8) : 'N/A'}</div>
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap">
                       <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                         {shift.branch_name}
                       </span>
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600 font-medium">
                       {new Date(shift.formatted_start_time).toLocaleString()}
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
          )}
        </div>

        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 shrink-0">
          <button 
            onClick={onClose}
            className="w-full bg-white border border-gray-300 text-gray-700 font-bold py-2.5 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            Close View
          </button>
        </div>

      </div>
    </div>
  );
};