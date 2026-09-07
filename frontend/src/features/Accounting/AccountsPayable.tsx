import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axiosInstance';

// --- Interfaces ---
interface PayableVendor {
  id: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  outstanding_balance: string | number; // Amount the business owes to the vendor
}

const AccountsPayable: React.FC = () => {
  const navigate = useNavigate();
  
  const [vendors, setVendors] = useState<PayableVendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // --- Fetch Data ---
  useEffect(() => {
    const fetchPayables = async () => {
      try {
        // Leverages a payables endpoint on the backend accounting app
        const response = await api.get('/accounting/payables/');
        setVendors(response.data);
      } catch (err) {
        console.error("Failed to load accounts payable", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPayables();
  }, []);

  // --- Derived State & Filtering ---
  const filteredVendors = useMemo(() => {
    return vendors.filter(v => 
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.phone && v.phone.includes(searchQuery))
    );
  }, [vendors, searchQuery]);

  const totalPayable = useMemo(() => {
    return vendors.reduce((sum, v) => sum + Number(v.outstanding_balance), 0);
  }, [vendors]);

  // Determine the correct routing prefix based on the user's role
  const userRole = localStorage.getItem('userRole');
  const routePrefix = userRole === 'Tenant_Admin' || userRole === 'ADMIN' ? '/admin' : '/manager';

  if (isLoading) {
    return <div className="p-10 text-center text-gray-500 font-medium">Loading Payables...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">Accounts Payable</h2>
          <p className="text-sm text-gray-500">Track and manage outstanding debts owed to suppliers and vendors.</p>
        </div>
        <div className="flex-shrink-0">
            <input 
              type="text" 
              placeholder="Search vendors..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-64 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:border-red-500 transition-colors"
            />
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-red-500">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Total Amount Payable</p>
          <p className="text-3xl font-black text-gray-900">₦{totalPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Vendors Owed</p>
          <p className="text-3xl font-bold text-gray-700">{vendors.length}</p>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 p-4 border-b border-gray-200">
          <h3 className="font-bold text-gray-800">Vendor Balances</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Vendor</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Contact</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Outstanding Balance</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                    No outstanding payables found.
                  </td>
                </tr>
              ) : (
                filteredVendors.map((vendor) => {
                  const balance = Number(vendor.outstanding_balance);

                  return (
                    <tr key={vendor.id} className="hover:bg-red-50/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">{vendor.name}</div>
                        <div className="text-xs font-mono text-gray-400">ID: {vendor.id.slice(0, 8)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div>{vendor.phone || '-'}</div>
                        <div className="text-xs text-gray-400">{vendor.email || vendor.contact_person || ''}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <span className="font-black text-red-600">
                          ₦{balance.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => navigate(`${routePrefix}/accounting/payables/${vendor.id}`)}
                          className="text-red-600 hover:text-red-800 font-bold text-sm bg-red-50 px-3 py-1 rounded transition-colors border border-red-100"
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

export default AccountsPayable;