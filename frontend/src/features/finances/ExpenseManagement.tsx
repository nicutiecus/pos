import React, { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';

// --- Interfaces ---
interface Expense {
  id: string | number;
  category: string; // Or a nested object depending on your backend
  amount: string | number;
  description: string;
  expense_date: string;
  payment_method: string;
  logged_by_name?: string;
}

const ExpenseManagement: React.FC = () => {
  const branchId = localStorage.getItem('branchId')?.replace(/['"]+/g, '') || '';
  const branchName = localStorage.getItem('branchName')?.replace(/['"]+/g, '') || 'My Branch';
  
  // --- State ---
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<any[]>([]); // New state for dynamic categories
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    category: '', // Will be set dynamically once categories load
    amount: '',
    payment_method: 'Cash from Drawer',
    expense_date: new Date().toISOString().split('T')[0],
    description: ''
  });

  // --- Fetch Data (Expenses & Categories) ---
  const loadData = async () => {
    setIsLoading(true);
    try {
      // Fetch both expenses and categories at the same time
      // NOTE: Adjust the categories endpoint to match your Django URL structure!
      const [expenseRes, categoryRes] = await Promise.all([
        api.get(`/finance/expenses/?branch_id=${branchId}`),
        api.get('/finance/expenses/categories/') // <--- Your new category endpoint
      ]);
      
      setExpenses(expenseRes.data);
      setCategories(categoryRes.data);

      // Auto-select the first category in the form if the array isn't empty
      if (categoryRes.data.length > 0) {
          const firstCat = categoryRes.data[0];
          // Handle both plain strings or objects {id, name}
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

    setIsSubmitting(true);
    try {
      const payload = {
        branch_id: branchId,
        category: formData.category, // This will now send the dynamic ID or String
        amount: Number(formData.amount),
        payment_method: formData.payment_method,
        expense_date: formData.expense_date,
        description: formData.description
      };

      await api.post('/finance/expenses/', payload);
      alert("Expense logged successfully!");
      
      // Reset amount and description, keep date and category
      setFormData(prev => ({ ...prev, amount: '', description: '' }));
      
      // Refresh the list to show the new expense
      await loadData();
      
    } catch (err: any) {
      alert(`Failed to log expense: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Helpers ---
  // A safe way to render the category name in the history table
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
            <h1 className="text-2xl font-bold text-gray-800">Expense Management</h1>
            <p className="text-sm text-gray-500">Log and track operational costs for {branchName}.</p>
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
                <div className="bg-blue-50 p-4 border-b border-blue-100">
                    <h3 className="font-bold text-blue-900">Log New Expense</h3>
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

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Category</label>
                        <select 
                            required
                            value={formData.category} 
                            onChange={e => setFormData({...formData, category: e.target.value})}
                            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium text-gray-800"
                        >
                            <option value="" disabled>-- Select Category --</option>
                            {/* DYNAMIC CATEGORY MAPPING */}
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
                            <p className="text-xs text-orange-600 mt-1 font-bold">⚠️ This will be deducted from today's expected cash.</p>
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
                        <p>No expenses recorded for this branch yet.</p>
                    </div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
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
                                        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
                                            {expense.payment_method}
                                        </span>
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