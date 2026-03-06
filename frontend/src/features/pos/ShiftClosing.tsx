import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/axiosInstance';
import { useReactToPrint } from 'react-to-print';

// --- Interfaces ---
interface ShiftSummary {
  shift_id: string;
  start_time: string;
  cashier_name: string;
  order_count: number;
  expected_cash: number;
  expected_pos: number;
  expected_transfer: number;
  total_revenue: number;
}

interface Props {
  onCancel: () => void;
  onLogout: () => void;
}

const ShiftClosing: React.FC<Props> = ({ onCancel, onLogout }) => {
  const userName = localStorage.getItem('userName')?.split('@')[0] || 'Cashier';
  const branchName = localStorage.getItem('branchName') || 'Main Branch';

  // --- State ---
  const [shiftData, setShiftData] = useState<ShiftSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClosed, setIsClosed] = useState(false);

  // Form State
  const [declaredCash, setDeclaredCash] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Print Ref
  const printRef = useRef<HTMLDivElement>(null);

  // --- Fetch Shift Data ---
  useEffect(() => {
    const fetchCurrentShift = async () => {
      try {
        // Adjust endpoint to match your Django URL
        const res = await api.get('/sales/reports/shift/current'); 
        setShiftData(res.data);
      } catch (err: any) {
        // If 404, it might mean no active shift exists
        console.error("Failed to fetch shift", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCurrentShift();
  }, []);

  // --- Handlers ---
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Shift_Report_${new Date().toISOString().split('T')[0]}`,
  });

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftData) return;
    
    if (declaredCash === '') {
        alert("You must declare the physical cash counted in the drawer.");
        return;
    }

    if (!window.confirm("Are you sure you want to close this shift? This action cannot be undone.")) return;

    setIsSubmitting(true);
    try {
      const payload = {
        shift_id: shiftData.shift_id,
        declared_cash: Number(declaredCash),
        expected_cash: shiftData.expected_cash,
        variance: Number(declaredCash) - shiftData.expected_cash,
        notes: notes
      };

      // Hit your Django backend to finalize the shift
      await api.post('/sales/reports/shift/close/', payload);
      
      setIsClosed(true);
      setTimeout(() => handlePrint(), 300); // Auto-print the Z-report
      
    } catch (err: any) {
      alert(`Failed to close shift: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Calculations ---
  const discrepancy = Number(declaredCash || 0) - (shiftData?.expected_cash || 0);
  const isShort = discrepancy < 0;
  //const isOver = discrepancy > 0;

  if (isLoading) return <div className="p-10 text-center text-gray-500">Loading Shift Data...</div>;

  if (!shiftData) return (
      <div className="p-10 max-w-lg mx-auto text-center mt-20 bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="text-4xl mb-4">🌙</div>
          <h2 className="text-xl font-bold text-gray-800">No Active Shift Found</h2>
          <p className="text-gray-500 mt-2">You have not processed any sales yet, or your shift is already closed.</p>
      </div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      
      {/* HEADER */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-gray-800">End of Day / Z-Report</h1>
            <p className="text-sm text-gray-500">Reconcile your cash drawer and close your session.</p>
        </div>
        <div className="flex items-center gap-6">
            <div className="text-right hidden md:block">
                <div className="text-sm font-bold text-gray-500 uppercase">Cashier</div>
                <div className="text-lg font-extrabold text-blue-700">{userName}</div>
            </div>
            {/* NEW CANCEL BUTTON */}
            {!isClosed && (
                <button onClick={onCancel} className="text-gray-500 hover:text-red-600 font-bold text-2xl leading-none">&times;</button>
            )}
        </div>
      </div>

      {isClosed ? (
          <div className="bg-green-50 border border-green-200 p-10 rounded-xl text-center space-y-4 animate-fade-in">
              <div className="text-5xl">✅</div>
              <h2 className="text-2xl font-bold text-green-900">Shift Closed Successfully</h2>
              <p className="text-green-700">Your shift report has been logged. You may now log out.</p>
              <div className="flex justify-center gap-4 mt-6">
                <button onClick={() => handlePrint()} className="mt-4 bg-green-600 text-white px-6 py-2 rounded-lg font-bold shadow hover:bg-green-700 transition-colors">
                    Reprint Report
                </button>
                {/* NEW LOGOUT BUTTON */}
                    <button onClick={onLogout} className="bg-green-600 text-white px-8 py-2 rounded-lg font-bold shadow hover:bg-green-700 transition-colors">
                        Complete & Log Out
                    </button>
                </div>
          </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* LEFT COLUMN: System Expected Totals */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 p-4 border-b border-gray-200">
                      <h3 className="font-bold text-gray-800">System Expectations</h3>
                  </div>
                  <div className="p-6 space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                          <span className="text-gray-600">Total Orders Processed</span>
                          <span className="font-bold text-gray-900">{shiftData.order_count}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                          <span className="text-gray-600">POS / Card Payments</span>
                          <span className="font-bold text-gray-900">₦{Number(shiftData.expected_pos).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                          <span className="text-gray-600">Bank Transfers</span>
                          <span className="font-bold text-gray-900">₦{Number(shiftData.expected_transfer).toLocaleString()}</span>
                      </div>
                      
                      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100 flex justify-between items-center">
                          <span className="font-bold text-blue-900">Expected Cash in Drawer</span>
                          <span className="text-2xl font-black text-blue-700">₦{Number(shiftData.expected_cash).toLocaleString()}</span>
                      </div>
                  </div>
              </div>

              {/* RIGHT COLUMN: Cashier Declaration */}
              <form onSubmit={handleCloseShift} className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
                  <div className="bg-blue-50 p-4 border-b border-blue-100">
                      <h3 className="font-bold text-blue-900">Drawer Reconciliation</h3>
                  </div>
                  <div className="p-6 flex-1 space-y-6">
                      
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">Counted Physical Cash (₦)</label>
                          <input 
                              type="number" 
                              required 
                              min="0"
                              value={declaredCash} 
                              onChange={e => setDeclaredCash(e.target.value)}
                              placeholder="Enter exact cash amount..."
                              className="w-full border border-gray-300 p-4 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-2xl font-bold text-gray-900" 
                          />
                      </div>

                      {/* Discrepancy Alert */}
                      {declaredCash !== '' && discrepancy !== 0 && (
                          <div className={`p-4 rounded-lg border ${isShort ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}>
                              <div className="text-sm font-bold mb-1">{isShort ? '⚠️ Cash Shortage' : '⚠️ Cash Overage'}</div>
                              <div className={`text-xl font-black ${isShort ? 'text-red-700' : 'text-orange-700'}`}>
                                  {isShort ? '-' : '+'} ₦{Math.abs(discrepancy).toLocaleString()}
                              </div>
                          </div>
                      )}

                      {declaredCash !== '' && discrepancy === 0 && (
                          <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 font-bold text-center">
                              ✅ Drawer is perfectly balanced!
                          </div>
                      )}

                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">Closing Notes (Optional)</label>
                          <textarea 
                              value={notes} 
                              onChange={e => setNotes(e.target.value)}
                              placeholder={discrepancy !== 0 ? "Please explain the discrepancy..." : "Any notes for the manager..."}
                              className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" 
                              rows={3}
                          />
                      </div>

                  </div>
                  <div className="p-4 border-t border-gray-100 bg-gray-50">
                      <button 
                          type="submit" 
                          disabled={isSubmitting || declaredCash === ''} 
                          className="w-full bg-gray-900 text-white p-4 rounded-lg font-bold hover:bg-black disabled:opacity-50 transition-colors shadow-lg"
                      >
                          {isSubmitting ? 'Processing...' : 'Close Shift & Print Z-Report'}
                      </button>
                  </div>
              </form>

          </div>
      )}

      {/* --- HIDDEN THERMAL RECEIPT FOR PRINTING --- */}
      <div style={{ display: 'none' }}>
        <div ref={printRef} className="p-4 text-black bg-white" style={{ width: '300px', fontFamily: 'monospace', fontSize: '12px' }}>
            <div className="text-center font-bold text-lg mb-1">{branchName}</div>
            <div className="text-center mb-4">END OF SHIFT (Z-REPORT)</div>
            
            <div className="border-b border-black border-dashed pb-2 mb-2">
                <div>Date: {new Date().toLocaleDateString()}</div>
                <div>Time: {new Date().toLocaleTimeString()}</div>
                <div>Cashier: {userName}</div>
                <div>Shift ID: {shiftData?.shift_id?.slice(0,8)}</div>
            </div>

            <div className="border-b border-black border-dashed pb-2 mb-2 space-y-1">
                <div className="flex justify-between"><span>Total Orders:</span> <span>{shiftData?.order_count}</span></div>
                <div className="flex justify-between"><span>Total Revenue:</span> <span>₦{Number(shiftData?.total_revenue).toLocaleString()}</span></div>
            </div>

            <div className="border-b border-black border-dashed pb-2 mb-2 space-y-1">
                <div className="font-bold mb-1">PAYMENT BREAKDOWN:</div>
                <div className="flex justify-between"><span>POS/Card:</span> <span>₦{Number(shiftData?.expected_pos).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Transfer:</span> <span>₦{Number(shiftData?.expected_transfer).toLocaleString()}</span></div>
                <div className="flex justify-between font-bold"><span>Expected Cash:</span> <span>₦{Number(shiftData?.expected_cash).toLocaleString()}</span></div>
            </div>

            <div className="border-b border-black border-dashed pb-2 mb-2 space-y-1">
                <div className="flex justify-between font-bold"><span>Declared Cash:</span> <span>₦{Number(declaredCash).toLocaleString()}</span></div>
                <div className="flex justify-between">
                    <span>Variance:</span> 
                    <span className={discrepancy < 0 ? 'text-red-500' : ''}>
                        {discrepancy > 0 ? '+' : ''}₦{discrepancy.toLocaleString()}
                    </span>
                </div>
            </div>

            {notes && (
                <div className="border-b border-black border-dashed pb-2 mb-2">
                    <div className="font-bold">Notes:</div>
                    <div>{notes}</div>
                </div>
            )}

            <div className="text-center mt-6 mb-2">_________________________</div>
            <div className="text-center mb-6">Cashier Signature</div>
            
            <div className="text-center mt-6 mb-2">_________________________</div>
            <div className="text-center">Manager Signature</div>
            <div className="text-center mt-4 text-xs">Generated by Equest POS</div>
        </div>
      </div>

    </div>
  );
};

export default ShiftClosing;