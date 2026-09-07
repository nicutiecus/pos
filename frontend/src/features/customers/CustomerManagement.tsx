import React, { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';
import CustomerEditModal from '../../components/customer/CustomerEditModal';
import CustomerLedgerModal from '../../components/customer/CustomerLedgerModal';
import DebtRepaymentModal from '../../components/customer/DebtRepaymentModal';

// --- Interfaces ---
export interface Customer {
  id: number;
  name: string;
  phone: string;
  credit_limit: number;
  current_debt: number;
  branch_specific_debt: number;
  created_at?: string;
}

export interface Branch {
  id: string | number;
  name: string;
}

const CustomerManagement: React.FC = () => {
  // --- Global State ---
  const userRole = localStorage.getItem('userRole');
  const branchId = localStorage.getItem('branchId');
  const isAdmin = userRole === 'Tenant_Admin' || userRole === 'ADMIN' || userRole === 'Super_Admin';

  // --- Data State ---
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // --- Filter State ---
  const [searchTerm, setSearchTerm] = useState('');
  const [showDebtorsOnly, setShowDebtorsOnly] = useState(false);

  // --- Pagination & Sorting State ---
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [globalTotalDebt, setGlobalTotalDebt] = useState(0);

  // --- Branch State ---
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);

  // --- Modal States ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [activeLedgerCustomer, setActiveLedgerCustomer] = useState<Customer | null>(null);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);

  // --- Fetch Data ---
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchCustomers();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, showDebtorsOnly, sortField, sortOrder, currentPage]);

  useEffect(() => {
    if (isAdmin && !branchId) {
      const fetchBranches = async () => {
        setIsLoadingBranches(true);
        try {
          const res = await api.get('/branches'); 
          setBranches(res.data); 
        } catch (error) {
          console.error("Failed to fetch branches:", error);
        } finally {
          setIsLoadingBranches(false);
        }
      };
      fetchBranches();
    }
  }, [isAdmin, branchId]);

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const ordering = sortOrder === 'desc' ? `-${sortField}` : sortField;
      const params = new URLSearchParams ({
        page: currentPage.toString(),
        search: searchTerm,
        ordering: ordering
      });

      if (showDebtorsOnly) params.append('has_debt', 'true');

      const res = await api.get(`/sales/customers/?${params.toString()}`);
      if (res.data.results) {
        setCustomers(res.data.results);
        setTotalPages(Math.ceil(res.data.count / 10)); 
        setGlobalTotalDebt(res.data.total_outstanding_debt || 0);
      } else {
        setCustomers(res.data);
        setTotalPages(1);
        setGlobalTotalDebt(res.data.reduce((sum: number, c: Customer) => sum + Number(c.current_debt), 0));
      }
    } catch (err) {
      console.error("Failed to fetch customers", err);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Handlers ---
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleEditClick = (customer: Customer) => {
    setEditingCustomer({ ...customer });
    setIsEditModalOpen(true);
  };

  const handleViewLedger = (customer: Customer) => {
    setActiveLedgerCustomer(customer);
    setIsLedgerOpen(true);
  };

  const handleOpenPayment = (customer: Customer) => {
    setPaymentCustomer(customer);
    setIsPaymentModalOpen(true);
  };

  const renderSortIndicator = (field: string) => {
    if (sortField !== field) return <span className="text-gray-300 ml-1">↕</span>;
    return sortOrder === 'asc' ? <span className="text-blue-600 ml-1">↑</span> : <span className="text-blue-600 ml-1">↓</span>;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* HEADER & METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-center">
          <h1 className="text-2xl font-bold text-gray-800">Customer Management</h1>
          <p className="text-sm text-gray-500">View customer details, update credit limits, and track debts.</p>
        </div>
        <div className="bg-red-50 p-6 rounded-xl shadow-sm border border-red-100 flex flex-col justify-center items-center text-center">
          <div className="text-sm font-bold text-red-600 uppercase tracking-wider mb-1">Total Outstanding Debt</div>
          <div className="text-3xl font-extrabold text-red-700">₦{globalTotalDebt.toLocaleString()}</div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between gap-4">
        <div className="flex-1 relative">
          <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
          <input 
            type="text" 
            placeholder="Search by Name or Phone..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center space-x-2 cursor-pointer bg-gray-50 px-3 py-2 rounded-lg border hover:bg-gray-100 transition-colors">
            <input 
              type="checkbox" 
              checked={showDebtorsOnly}
              onChange={(e) => setShowDebtorsOnly(e.target.checked)}
              className="rounded text-red-500 focus:ring-red-500 w-4 h-4"
            />
            <span className="text-sm font-medium text-gray-700">Show Debtors Only</span>
          </label>
          <button 
            onClick={() => { setEditingCustomer({ id: 0, name: '', phone: '', credit_limit: 0, current_debt: 0, branch_specific_debt: 0 }); setIsEditModalOpen(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm"
          >
            + New Customer
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500">Loading Customers...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th onClick={() => handleSort('name')} className="cursor-pointer hover:bg-gray-100 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase select-none transition-colors">
                    Customer Name {renderSortIndicator('name')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                  <th onClick={() => handleSort('credit_limit')} className="cursor-pointer hover:bg-gray-100 px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase select-none transition-colors">
                    Credit Limit {renderSortIndicator('credit_limit')}
                  </th>
                  <th onClick={() => handleSort('current_debt')} className="cursor-pointer hover:bg-gray-100 px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase select-none transition-colors">
                    {isAdmin ? 'Total Debt' : 'Branch Debt'} {renderSortIndicator(isAdmin ? 'current_debt' : 'branch_specific_debt')}
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {customers.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-gray-400">No customers found.</td></tr>
                ) : (
                  customers.map(customer => (
                    <tr key={customer.id} className="hover:bg-blue-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{customer.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{customer.phone}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">₦{Number(customer.credit_limit).toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className={`font-bold ${customer.current_debt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          ₦{Number(isAdmin ? customer.current_debt : customer.branch_specific_debt).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-3">
                        {(isAdmin ? customer.current_debt : customer.branch_specific_debt) > 0 && (
                          <button 
                            onClick={() => handleOpenPayment(customer)} 
                            className="text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded shadow-sm transition-colors"
                          >
                            💳 Pay
                          </button>
                        )}
                        <button onClick={() => handleViewLedger(customer)} className="text-blue-600 hover:text-blue-900 bg-blue-50 px-2 py-1 rounded">
                          📓 Ledger
                        </button>
                        <button onClick={() => handleEditClick(customer)} className="text-gray-600 hover:text-gray-900 bg-gray-100 px-2 py-1 rounded">
                          ✏️ Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* --- PAGINATION FOOTER --- */}
        {!isLoading && totalPages > 1 && (
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Page <span className="font-bold text-gray-800">{currentPage}</span> of <span className="font-bold text-gray-800">{totalPages}</span>
            </span>
            <div className="flex space-x-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- MODALS --- */}
      <CustomerEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={fetchCustomers}
        customer={editingCustomer}
        isAdmin={isAdmin}
      />

      <CustomerLedgerModal
        isOpen={isLedgerOpen}
        onClose={() => setIsLedgerOpen(false)}
        customer={activeLedgerCustomer}
        isAdmin={isAdmin}
        branchId={branchId}
      />

      <DebtRepaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={fetchCustomers}
        customer={paymentCustomer}
        isAdmin={isAdmin}
        branches={branches}
        isLoadingBranches={isLoadingBranches}
        branchId={branchId}
      />

    </div>
  );
};

export default CustomerManagement;