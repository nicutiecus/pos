import React, { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';
import { isAxiosError } from 'axios';

// --- Interfaces ---
interface AccountingPeriod {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: 'Open' | 'Closed';
}

interface FinancialYear {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_closed: boolean;
  periods: AccountingPeriod[];
}

const FinancialYearsManagement: React.FC = () => {
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    start_date: '',
    end_date: ''
  });

  const fetchYears = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/accounting/financial-years/');
      setFinancialYears(res.data);
    } catch (err) {
      console.error("Failed to fetch financial years", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchYears();
  }, []);

  const handleCreateYear = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    try {
      await api.post('/accounting/financial-years/', formData);
      setFeedback({ type: 'success', message: 'Financial Year and monthly periods generated successfully!' });
      setFormData({ name: '', start_date: '', end_date: '' });
      setShowForm(false);
      fetchYears(); // Refresh the list
    } catch (err) {
      if (isAxiosError(err)) {
        setFeedback({ type: 'error', message: err.response?.data?.error || 'Failed to create financial year.' });
      } else {
        setFeedback({ type: 'error', message: 'An unexpected error occurred.' });
      }
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const handleTogglePeriod = async (periodId: number, currentStatus: string, yearIsClosed: boolean) => {
    if (yearIsClosed) {
      alert("Cannot modify periods in a closed financial year.");
      return;
    }

    const newStatus = currentStatus === 'Open' ? 'Closed' : 'Open';
    const confirmMsg = newStatus === 'Closed' 
      ? "Are you sure you want to CLOSE this period? Users will no longer be able to post backdated transactions to this month." 
      : "Are you sure you want to RE-OPEN this period?";

    if (!window.confirm(confirmMsg)) return;

    try {
      await api.patch(`/accounting/periods/${periodId}/`, { status: newStatus });
      fetchYears(); // Refresh data to show new status
    } catch (err) {
      if (isAxiosError(err)) {
        alert(`Failed to update period: ${err.response?.data?.error || err.message}`);
      }
    }
  };

  const handleYearEndClose = async (yearId: number, yearName: string) => {
    const confirmMsg = `CRITICAL ACTION: Are you sure you want to perform the Year-End Close for ${yearName}?\n\nThis will zero out all Revenue and Expense accounts to Retained Earnings and permanently lock the year. THIS CANNOT BE UNDONE.`;
    
    if (!window.confirm(confirmMsg)) return;

    try {
      await api.post(`/accounting/financial-years/${yearId}/close/`);
      setFeedback({ type: 'success', message: `${yearName} has been successfully closed and profits moved to Retained Earnings.` });
      fetchYears();
    } catch (err) {
      if (isAxiosError(err)) {
        alert(`Year-End Close failed: ${err.response?.data?.error || err.message}`);
      }
    }
  };

  if (isLoading) {
    return <div className="p-10 text-center text-gray-500 font-medium">Loading Financial Years...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">Financial Periods</h2>
          <p className="text-sm text-gray-500">Manage fiscal years, lock accounting periods, and execute year-end closing.</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold transition-colors shadow-sm"
        >
          {showForm ? 'Cancel' : '+ New Financial Year'}
        </button>
      </div>

      {feedback && (
        <div className={`p-4 rounded-lg shadow-sm border-l-4 font-medium animate-fade-in-down ${
          feedback.type === 'success' ? 'bg-green-50 border-green-500 text-green-800' : 'bg-red-50 border-red-500 text-red-800'
        }`}>
          {feedback.message}
        </div>
      )}

      {/* CREATE FORM */}
      {showForm && (
        <form onSubmit={handleCreateYear} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 animate-fade-in-down">
          <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Initialize New Financial Year</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Year Name</label>
              <input 
                type="text" required placeholder="e.g. FY 2026"
                value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Start Date</label>
              <input 
                type="date" required 
                value={formData.start_date} onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">End Date</label>
              <input 
                type="date" required 
                value={formData.end_date} onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50">
              {isSubmitting ? 'Generating...' : 'Generate Year & Periods'}
            </button>
          </div>
        </form>
      )}

      {/* LIST OF FINANCIAL YEARS */}
      <div className="space-y-6">
        {financialYears.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl border border-gray-200 text-gray-500">
            <span className="text-4xl block mb-3">📅</span>
            No financial years have been configured yet.
          </div>
        ) : (
          financialYears.map((fy) => (
            <div key={fy.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Year Header */}
              <div className={`p-5 flex justify-between items-center ${fy.is_closed ? 'bg-gray-100' : 'bg-blue-50 border-b border-blue-100'}`}>
                <div>
                  <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                    {fy.name}
                    {fy.is_closed ? (
                      <span className="text-[10px] uppercase tracking-wider bg-gray-300 text-gray-700 px-2 py-0.5 rounded font-bold">Closed</span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wider bg-green-200 text-green-800 px-2 py-0.5 rounded font-bold">Active</span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-600 font-medium mt-1">
                    {new Date(fy.start_date).toLocaleDateString()} — {new Date(fy.end_date).toLocaleDateString()}
                  </p>
                </div>
                
                {!fy.is_closed && (
                  <button 
                    onClick={() => handleYearEndClose(fy.id, fy.name)}
                    className="bg-gray-900 hover:bg-black text-white px-4 py-2 rounded font-bold text-sm shadow transition-colors"
                  >
                    Execute Year-End Close
                  </button>
                )}
              </div>

              {/* Monthly Periods Grid */}
              <div className="p-6">
                <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Accounting Periods</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {fy.periods.map((period) => (
                    <div key={period.id} className={`p-4 rounded-lg border ${period.status === 'Open' ? 'border-blue-200 bg-white shadow-sm' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-gray-800">{period.name}</span>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${period.status === 'Open' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                          {period.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mb-3">
                        {new Date(period.start_date).toLocaleDateString()} to {new Date(period.end_date).toLocaleDateString()}
                      </div>
                      
                      <button
                        onClick={() => handleTogglePeriod(period.id, period.status, fy.is_closed)}
                        disabled={fy.is_closed}
                        className={`w-full py-1.5 rounded text-xs font-bold transition-colors border ${
                          fy.is_closed ? 'bg-gray-200 text-gray-400 cursor-not-allowed border-transparent' :
                          period.status === 'Open' ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        {period.status === 'Open' ? 'Lock Period' : 'Re-Open'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FinancialYearsManagement;