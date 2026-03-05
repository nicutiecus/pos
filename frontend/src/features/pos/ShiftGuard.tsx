import React, { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';

interface ShiftGuardProps {
  children: React.ReactNode;
}

interface Branch {
  id: number;
  name: string;
}

const ShiftGuard: React.FC<ShiftGuardProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasActiveShift, setHasActiveShift] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Tenant Admin Specific State ---
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [isFetchingBranches, setIsFetchingBranches] = useState(false);

  // Retrieve current identifiers
  const userId = localStorage.getItem('userId');
  const userRole = localStorage.getItem('userRole'); // e.g., 'Tenant_Admin', 'Branch_Manager', 'Cashier'
  const savedBranchId = localStorage.getItem('branchId');

  const checkActiveShift = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/sales/shift/active/');
      
      if (response.data.status === 'active') {
        localStorage.setItem('shift_code', response.data.shift_code);
        setHasActiveShift(true);
      } else {
        setHasActiveShift(false);
        // If they are an admin and need to start a shift, fetch the branches for the dropdown
        if (userRole === 'Tenant_Admin') {
            fetchBranches();
        }
      }
    } catch (err: any) {
      console.error("Failed to check shift status:", err);
      setError("Failed to connect to the server to verify shift status.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBranches = async () => {
      setIsFetchingBranches(true);
      try {
          const res = await api.get('/branches'); // Reusing your existing branch endpoint
          setBranches(res.data);
      } catch (err) {
          console.error("Failed to load branches:", err);
          setError("Failed to load available branches. Please refresh the page.");
      } finally {
          setIsFetchingBranches(false);
      }
  };

  useEffect(() => {
    checkActiveShift();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartShift = async () => {
    // Validation for Tenant Admin
    if (userRole === 'Tenant_Admin' && !selectedBranchId) {
        setError("As a Tenant Admin, you must select a branch to operate before starting a shift.");
        return;
    }

    // Determine which branch ID to send
    const finalBranchId = userRole === 'Tenant_Admin' ? selectedBranchId : savedBranchId;

    if (!finalBranchId) {
        setError("Critical Error: No Branch ID found for this user.");
        return;
    }

    setIsStarting(true);
    setError(null);
    
    try {
      const response = await api.post('/sales/shift/start/', {
        branch_id: finalBranchId,
        cashier_id: userId
      });

      // Save the newly generated shift code
      localStorage.setItem('shift_code', response.data.shift_code);
      
      // If Admin, lock in their selected branch for the duration of this shift
      // This is crucial so the ProductGrid loads the correct inventory!
      if (userRole === 'Tenant_Admin') {
          localStorage.setItem('branchId', finalBranchId);
      }

      setHasActiveShift(true);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to start a new shift.");
    } finally {
      setIsStarting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mb-4"></div>
          <p className="text-gray-500 font-bold">Verifying Shift Status...</p>
        </div>
      </div>
    );
  }

  if (hasActiveShift) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-gray-200 animate-fade-in-down">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-6">
          <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        
        <h2 className="text-2xl font-black text-gray-900 mb-2">Shift Closed</h2>
        <p className="text-gray-500 mb-6 text-sm">
          You currently do not have an active sales shift. You must start a new shift to begin processing transactions.
        </p>

        {error && (
          <div className="mb-6 p-3 bg-red-50 text-red-700 text-sm rounded text-left border-l-4 border-red-500 font-medium">
            {error}
          </div>
        )}

        {/* --- DYNAMIC BRANCH SELECTOR FOR ADMINS --- */}
        {userRole === 'Tenant_Admin' && (
            <div className="mb-6 text-left">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                    Operating Branch <span className="text-red-500">*</span>
                </label>
                {isFetchingBranches ? (
                    <div className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 text-sm flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                        Loading branches...
                    </div>
                ) : (
                    <select 
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium text-gray-800"
                    >
                        <option value="" disabled>-- Select a Branch to operate in --</option>
                        {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                )}
            </div>
        )}

        <button
          onClick={handleStartShift}
          disabled={isStarting || (userRole === 'Tenant_Admin' && !selectedBranchId)}
          className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-md hover:shadow-lg"
        >
          {isStarting ? 'Opening Drawer...' : 'Start New Shift'}
        </button>
      </div>
    </div>
  );
};

export default ShiftGuard;