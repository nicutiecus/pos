import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axiosInstance';

// --- Interfaces ---
interface Receivable {
  id: string;
  name: string;
  phone: string;
  email: string;
  credit_limit: string | number;
  current_debt: string | number;
}

const AccountsReceivable: React.FC = () => {
  const navigate = useNavigate();
  
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // --- Fetch Data ---
  useEffect(() => {
    const fetchReceivables = async () => {
      try {
        // Leverages the ReceivableListApi endpoint defined in backend/accounting/urls.py
        const response = await api.get('/accounting/receivables/');
        setReceivables(response.data);
      } catch (err) {
        console.error("Failed to load receivables", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReceivables();
  }, []);

  // --- Derived State & Filtering ---
  const filteredReceivables = useMemo(() => {
    return receivables.filter(r => 
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.phone && r.phone.includes(searchQuery))
    );
  }, [receivables, searchQuery]);

  const totalOutstanding = useMemo(() => {
    return receivables.reduce((sum, r) => sum + Number(r.current_debt), 0);
  }, [receivables]);

  // Determine the correct routing prefix based on the user's role
  const userRole = localStorage.getItem('userRole');
  const routePrefix = userRole === 'Tenant_Admin' || userRole === 'ADMIN' ? '/admin' : '/manager';

  if (isLoading) {
    return <div className="p-10 text-center text-gray-500 font-medium">Loading Receivables...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">Accounts Receivable</h2>
          <p className="text-sm text-gray-500">Track and manage outstanding customer debts.</p>
        </div>
        <div className="flex-shrink-0">
            <input 
              type="text" 
              placeholder="Search customers..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-64 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500"
            />
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-orange-500">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Total Outstanding Debt</p>
          <p className="text-3xl font-black text-gray-900">₦{totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Customers in Debt</p>
          <p className="text-3xl font-bold text-gray-700">{receivables.length}</p>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 p-4 border-b border-gray-200">
          <h3 className="font-bold text-gray-800">Customer Balances</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Contact</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Credit Limit</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Current Debt</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredReceivables.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                    No outstanding receivables found.
                  </td>
                </tr>
              ) : (
                filteredReceivables.map((customer) => {
                  const debt = Number(customer.current_debt);
                  const limit = Number(customer.credit_limit);
                  const isNearLimit = debt > (limit * 0.8); // Flag if debt is > 80% of limit

                  return (
                    <tr key={customer.id} className="hover:bg-orange-50/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">{customer.name}</div>
                        <div className="text-xs font-mono text-gray-400">ID: {customer.id.slice(0, 8)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div>{customer.phone || '-'}</div>
                        <div className="text-xs text-gray-400">{customer.email || ''}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right font-medium">
                        ₦{limit.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <span className={`font-black ${isNearLimit ? 'text-red-600' : 'text-orange-600'}`}>
                          ₦{debt.toLocaleString()}
                        </span>
                        {isNearLimit && (
                          <div className="text-[10px] text-red-500 font-bold uppercase mt-1">Near Limit</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => navigate(`${routePrefix}/accounting/receivables/${customer.id}`)}
                          className="text-blue-600 hover:text-blue-800 font-bold text-sm bg-blue-50 px-3 py-1 rounded transition-colors border border-blue-100"
                        >
                          View Ledger
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default AccountsReceivable;