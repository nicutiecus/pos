import React, { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';

// --- Interfaces ---
interface Expense {
  id: string | number;
  category: string;
  scope: string;
  amount: string | number;
  description: string;
  expense_date: string;
  payment_method: string;
  logged_by_name?: string;
  branch_name?: string; // Helpful for admins to see which branch an expense belongs to
}

interface Branch {
  id: string;
  name: string;
}

const ExpenseManagement: React.FC = () => {
  const branchId = localStorage.getItem('branchId')?.replace(/['"]+/g, '') || '';
  const branchName = localStorage.getItem('branchName')?.replace(/['"]+/g, '') || 'My Branch';
  
  // --- Role Check ---
  // Adjust 'userRole' to match exactly what you store in localStorage (e.g., 'role', 'userType', etc.)
  const userRole = localStorage.getItem('userRole')?.replace(/['"]+/g, '') || '';
  const isAdmin = userRole === 'Tenant_Admin' || userRole === 'admin';
  
  // --- State ---
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]); // For Admins to select branches
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    category: '', 
    amount: '',
    payment_method: 'Cash from Drawer',
    expense_date: new Date().toISOString().split('T')[0],
    description: '',
    scope: isAdmin ? 'Corporate' : 'Branch', // Default depends on role
    target_branch_id: branchId, // Defaults to local branch, Admin can change it
  });

  // --- Fetch Data ---
  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Prepare base API calls
      // If admin, they might want to see ALL expenses. If you have an endpoint for that, adjust the URL.
      const expenseUrl = isAdmin ? '/finance/expenses/' : `/finance/expenses/?branch_id=${branchId}`;
      
      const promises = [
        api.get(expenseUrl),
        api.get('/finance/expenses/categories/')
      ];

      // 2. If Admin, fetch the list of branches for the dropdown
      // Ensure this matches your Django endpoint for fetching branches
      if (isAdmin) {
          promises.push(api.get('/branches/')); 
      }

      const results = await Promise.all(promises);
      
      setExpenses(results[0].data.results || results[0].data);
      setCategories(results[1].data.results || results[1].data);

      if (isAdmin && results[2]) {
          setBranches(results[2].data.results || results[2].data);
      }

      // 3. Auto-select the first category
      const fetchedCats = results[1].data.results || results[1].data;
      if (fetchedCats && fetchedCats.length > 0) {
          const firstCat = fetchedCats[0];
          const defaultCatValue = typeof firstCat === 'string' ? firstCat : (firstCat.id || firstCat.name);
          setFormData(prev => ({ ...prev, category: defaultCatValue }));
      }

    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [branchId]);

  // --- Handlers ---
  const handleLogExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.description || !formData.category) {
      alert("Please fill in all required fields.");
      return;
    }

    if (formData.scope === 'Branch' && !formData.target_branch_id) {
        alert("Please select a branch for this expense.");
        return;
    }

    setIsSubmitting(true);
    try {
      // Build the intelligent payload based on Role and Scope
      const payload = {
        category: formData.category,
        amount: Number(formData.amount),
        payment_method: formData.payment_method,
        expense_date: formData.expense_date,
        description: formData.description,
        scope: formData.scope,
        // If scope is corporate, branch_id is null. Otherwise, use the selected branch (Admin) or local branch (Manager)
        branch_id: formData.scope === 'Corporate' ? null : formData.target_branch_id, 
      };

      await api.post('/finance/expenses/', payload);
      alert("Expense logged successfully!");
      
      // Reset text fields, preserve dropdown choices
      setFormData(prev => ({ ...prev, amount: '', description: '' }));
      
      await loadData();
      
    } catch (err: any) {
      alert(`Failed to log expense: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Helpers ---
  const getCategoryName = (catData: any) => {
      if (!catData) return 'Unknown';
      if (typeof catData === 'string') return catData;
      return catData.name || 'Unknown';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* HEADER */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-gray-800">
                {isAdmin ? 'Global Expense Management' : 'Expense Management'}
            </h1>
            <p className="text-sm text-gray-500">
                {isAdmin ? 'Log and track corporate and branch operational costs.' : `Log and track operational costs for ${branchName}.`}
            </p>
        </div>
        <div className="text-right hidden md:block">
            <div className="text-sm font-bold text-gray-500 uppercase">Today's Date</div>
            <div className="text-lg font-extrabold text-blue-700">{new Date().toLocaleDateString()}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Log Expense Form */}
        <div className="lg:col-span-1">
            <form onSubmit={handleLogExpense} className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                <div className="bg-blue-50 p-4 border-b border-blue-100 flex justify-between items-center">
                    <h3 className="font-bold text-blue-900">Log New Expense</h3>
                    {isAdmin && <span className="text-[10px] font-bold bg-blue-200 text-blue-800 px-2 py-0.5 rounded uppercase">Admin Mode</span>}
                </div>
                
                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Amount (₦)</label>
                        <input 
                            type="number" 
                            required 
                            min="1"
                            value={formData.amount} 
                            onChange={e => setFormData({...formData, amount: e.target.value})}
                            placeholder="e.g. 5000"
                            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xl font-bold text-gray-900" 
                        />
                    </div>

                    {/* ONLY VISIBLE TO ADMINS */}
                    {isAdmin && (
                        <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                            <div className="col-span-2">
                                <label className="block text-sm font-bold text-gray-700 mb-1">Expense Scope</label>
                                <select 
                                    value={formData.scope} 
                                    onChange={e => setFormData({...formData, scope: e.target.value})}
                                    className="w-full border border-gray-300 p-2.5 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium text-gray-800"
                                >
                                    <option value="Corporate">Corporate (Entire Business)</option>
                                    <option value="Branch">Specific Branch</option>
                                </select>
                            </div>

                            {/* DYNAMIC Branch SELECTOR (Only if scope is Branch) */}
                            {formData.scope === 'Branch' && (
                                <div className="col-span-2 mt-2">
                                    <label className="block text-sm font-bold text-gray-700 mb-1 flex justify-between">
                                        Assign to Branch
                                        {branches.length === 0 && <span className="text-[10px] text-red-500">Loading...</span>}
                                    </label>
                                    <select 
                                        required
                                        value={formData.target_branch_id} 
                                        onChange={e => setFormData({...formData, target_branch_id: e.target.value})}
                                        className="w-full border border-gray-300 p-2.5 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium text-gray-800"
                                    >
                                        <option value="" disabled>-- Select Branch --</option>
                                        {branches.map((b) => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Category</label>
                        <select 
                            required
                            value={formData.category} 
                            onChange={e => setFormData({...formData, category: e.target.value})}
                            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium text-gray-800"
                        >
                            <option value="" disabled>-- Select Category --</option>
                            {categories.map((cat, idx) => {
                                const value = typeof cat === 'string' ? cat : (cat.id || cat.name);
                                const label = typeof cat === 'string' ? cat : cat.name;
                                return (
                                    <option key={idx} value={value}>{label}</option>
                                );
                            })}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Payment Source</label>
                        <select 
                            value={formData.payment_method} 
                            onChange={e => setFormData({...formData, payment_method: e.target.value})}
                            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium text-gray-800"
                        >
                            <option value="Cash from Drawer">Cash (From POS Drawer)</option>
                            <option value="Corporate Bank Transfer">Corporate Bank Transfer</option>
                            <option value="Manager Out of Pocket">Manager (Out of Pocket / Reimburse)</option>
                        </select>
                        {formData.payment_method === 'Cash from Drawer' && (
                            <p className="text-[11px] text-orange-600 mt-1 font-bold">⚠️ Deducted from today's expected cash.</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Date</label>
                        <input 
                            type="date" 
                            required 
                            value={formData.expense_date} 
                            onChange={e => setFormData({...formData, expense_date: e.target.value})}
                            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-800" 
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Description / Notes</label>
                        <textarea 
                            required
                            value={formData.description} 
                            onChange={e => setFormData({...formData, description: e.target.value})}
                            placeholder="e.g. 20 Litres of diesel for generator"
                            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" 
                            rows={3}
                        />
                    </div>
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-100">
                    <button 
                        type="submit" 
                        disabled={isSubmitting || categories.length === 0} 
                        className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                        {isSubmitting ? 'Saving...' : 'Record Expense'}
                    </button>
                </div>
            </form>
        </div>

        {/* RIGHT COLUMN: Expense History */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
            <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-bold text-gray-800">Recent Expenses</h3>
                <span className="text-xs font-bold text-gray-500 bg-gray-200 px-2 py-1 rounded">Last 30 Days</span>
            </div>
            
            <div className="flex-1 overflow-auto">
                {isLoading ? (
                    <div className="p-10 text-center text-gray-500">Loading data...</div>
                ) : expenses.length === 0 ? (
                    <div className="p-16 text-center text-gray-400">
                        <div className="text-4xl mb-3">🧾</div>
                        <p>No expenses recorded yet.</p>
                    </div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Details</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Source & Scope</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {expenses.map((expense, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(expense.expense_date).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-bold text-gray-900">{getCategoryName(expense.category)}</div>
                                        <div className="text-xs text-gray-500 truncate max-w-[200px]" title={expense.description}>
                                            {expense.description}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col items-start gap-1">
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                                                {expense.payment_method}
                                            </span>
                                            {/* Show scope badge to admins */}
                                            {isAdmin && (
                                                <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                                    expense.scope === 'Corporate' ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-blue-100 text-blue-800 border border-blue-200'
                                                }`}>
                                                    {expense.scope} {expense.scope === 'Branch' && expense.branch_name ? `(${expense.branch_name})` : ''}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-red-600">
                                        -₦{Number(expense.amount).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>

      </div>
    </div>
  );
};

export default ExpenseManagement;