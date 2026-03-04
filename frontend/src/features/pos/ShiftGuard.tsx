import React, { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';

interface ShiftGuardProps {
  children: React.ReactNode;
}

const ShiftGuard: React.FC<ShiftGuardProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasActiveShift, setHasActiveShift] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Retrieve identifiers needed to start a shift
  const branchId = localStorage.getItem('branchId');
  const userId = localStorage.getItem('userId'); // Assuming the cashier's user ID is stored here

  const checkActiveShift = async () => {
    setIsLoading(true);
    try {
      // Hits the endpoint to check if a shift is already open for this user/branch
      const response = await api.get('/sales/shift/active/');
      
      if (response.data.status === 'active') {
        // Save the shift code to local storage or state so the PaymentModal can use it later
        localStorage.setItem('shift_code', response.data.shift_code);
        setHasActiveShift(true);
      } else {
        // status is "none", require them to start one
        setHasActiveShift(false);
      }
    } catch (err: any) {
      console.error("Failed to check shift status:", err);
      // Failsafe: If offline, you might want to allow them in if they have a local shift cached
      const localShift = localStorage.getItem('shift_code');
      if (localShift) {
          setHasActiveShift(true);
      } else {
          setError("Failed to connect to the server to verify shift status.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkActiveShift();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartShift = async () => {
    setIsStarting(true);
    setError(null);
    try {
      // Hits the endpoint to create a brand new shift
      const response = await api.post('/sales/shift/start/', {
        branch_id: branchId,
        cashier_id: userId
      });

      // Save the newly generated shift code
      localStorage.setItem('shift_code', response.data.shift_code);
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

  // If a shift exists, render the actual POS application!
  if (hasActiveShift) {
    return <>{children}</>;
  }

  // If no shift exists, render the blocking "Start Shift" screen
  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-gray-200 animate-fade-in-down">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-6">
          <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        
        <h2 className="text-2xl font-black text-gray-900 mb-2">Shift Closed</h2>
        <p className="text-gray-500 mb-8">
          You currently do not have an active sales shift. You must start a new shift to begin processing transactions.
        </p>

        {error && (
          <div className="mb-6 p-3 bg-red-50 text-red-700 text-sm rounded text-left border-l-4 border-red-500">
            {error}
          </div>
        )}

        <button
          onClick={handleStartShift}
          disabled={isStarting}
          className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-md hover:shadow-lg"
        >
          {isStarting ? 'Opening Drawer...' : 'Start New Shift'}
        </button>
      </div>
    </div>
  );
};

export default ShiftGuard;