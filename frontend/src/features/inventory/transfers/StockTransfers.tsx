import React, { useState, useEffect } from 'react';
import api from '../../../api/axiosInstance';
// We don't necessarily need the custom date formatter if the backend sends "formatted_date", 
// but we'll keep it just in case we need to format other dates.

// --- Interfaces ---
interface Branch {
  id: string;
  name: string;
}

interface Product {
  id: number;
  name: string;
  sku: string;
}

// Updated to perfectly match your Django JSON response
interface StockTransfer {
  id: string;
  product_name: string;
  source_branch_name: string;
  destination_branch_name: string;
  quantity: string;
  transferred_by_email: string;
  notes: string;
  formatted_date: string;
  status: string; // e.g., "Pending", "Completed"
}

const StockTransfers: React.FC = () => {
  // Clean variables to prevent JSON.stringify quote bugs
  const userRole = localStorage.getItem('userRole')?.replace(/['"]+/g, '');
  const storedBranchId = localStorage.getItem('branchId')?.replace(/['"]+/g, '') || '';
  const storedBranchName = localStorage.getItem('branchName')?.replace(/['"]+/g, '') || 'My Branch';
  const isAdmin = userRole === 'Tenant_Admin' || userRole === 'ADMIN';

  // --- State ---
  const [activeTab, setActiveTab] = useState<'CREATE' | 'INCOMING' | 'HISTORY'>('CREATE');
  
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State for creating a transfer
  const [formData, setFormData] = useState({
    source_branch_id: isAdmin ? '' : storedBranchId,
    destination_branch_id: '',
    product_id: '',
    quantity: ''
  });

  // --- Fetch Data ---
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [branchRes, prodRes, transferRes] = await Promise.all([
          api.get('/branches/destinations'), // Adjust if needed
          api.get('/inventory/catalog/'), 
          api.get('/inventory/transfers/logs') // This returns the JSON you provided
        ]);
        
        setBranches(branchRes.data);
        setProducts(prodRes.data);
        setTransfers(transferRes.data);
      } catch (err) {
        console.error("Failed to load transfer data", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // --- Handlers ---
  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.source_branch_id || !formData.destination_branch_id || !formData.product_id || !formData.quantity) {
        alert("Please fill all fields.");
        return;
    }
    if (formData.source_branch_id === formData.destination_branch_id) {
        alert("Source and Destination branches must be different.");
        return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        source_branch_id: formData.source_branch_id,
        destination_branch_id: formData.destination_branch_id,
        product_id: Number(formData.product_id),
        quantity: Number(formData.quantity)
      };

      await api.post('/inventory/transfers/initiate/', payload);
      alert("Transfer initiated successfully!");
      
      // Reset form & refresh list
      setFormData(prev => ({ ...prev, product_id: '', quantity: '' }));
      const res = await api.get('/inventory/transfers/logs');
      setTransfers(res.data);
      setActiveTab('HISTORY');
      
    } catch (err: any) {
      alert(`Transfer failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptTransfer = async (transferId: string) => {
    if (!window.confirm("Are you sure you want to accept this stock? It will be added to your inventory immediately.")) return;
    
    try {
        await api.post(`/inventory/transfers/${transferId}/accept/`);
        alert("Transfer accepted! Stock added to inventory.");
        
        // Refresh list
        const res = await api.get('/inventory/transfers/logs');
        setTransfers(res.data);
    } catch (err: any) {
        alert(`Failed to accept transfer: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleRejectTransfer = async (transferId: string) => {
    if (!window.confirm("Are you sure you want to reject this stock?")) return;
    
    try {
        await api.post(`/inventory/transfers/${transferId}/reject/`);
        alert("Transfer rejected! Stock not added to your inventory.");
        
        // Refresh list
        const res = await api.get('/inventory/transfers/logs');
        setTransfers(res.data);
    } catch (err: any) {
        alert(`Failed to accept transfer: ${err.response?.data?.message || err.message}`);
    }
  };

  // --- Derived Data ---
  // Filter for INCOMING based on Status "Pending" and matching the branch name
  const incomingTransfers = transfers.filter(t => {
      const isPending = t.status?.toLowerCase() === 'pending' || t.status?.toLowerCase() === 'in_transit';
      const isForMe = isAdmin || t.destination_branch_name === storedBranchName;
      return isPending && isForMe;
  });
  //debugging
  

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* HEADER */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-gray-800">Inter-Branch Transfers</h1>
            <p className="text-sm text-gray-500">Move stock securely between locations.</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-lg">
            {(['CREATE', 'INCOMING', 'HISTORY'] as const).map(tab => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-sm font-bold rounded-md capitalize transition-colors flex items-center gap-2 ${
                        activeTab === tab ? 'bg-white shadow-sm text-blue-700' : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                    {tab === 'INCOMING' && incomingTransfers.length > 0 && (
                        <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{incomingTransfers.length}</span>
                    )}
                    {tab}
                </button>
            ))}
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-gray-500">Loading Transfer Data...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            
            {/* --- TAB: CREATE TRANSFER --- */}
            {activeTab === 'CREATE' && (
                <form onSubmit={handleCreateTransfer} className="p-8 max-w-3xl mx-auto space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-blue-50 border border-blue-100 rounded-xl relative">
                        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-full p-2 shadow-sm border border-blue-200 hidden md:block z-10">
                            ➡️
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-blue-900 mb-1">Source Branch (From)</label>
                            <select 
                                value={formData.source_branch_id} 
                                onChange={e => setFormData({...formData, source_branch_id: e.target.value})}
                                disabled={!isAdmin} 
                                className="w-full border border-blue-200 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-gray-100 disabled:text-gray-700 disabled:font-bold disabled:cursor-not-allowed"
                            >
                                <option value="">-- Select Source --</option>
                                {/* Inject manager's branch if missing from API */}
                                {!isAdmin && storedBranchId && !branches.some(b => String(b.id) === storedBranchId) && (
                                    <option value={storedBranchId}>{storedBranchName}</option>
                                )}
                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-blue-900 mb-1">Destination Branch (To)</label>
                            <select 
                                value={formData.destination_branch_id} 
                                onChange={e => setFormData({...formData, destination_branch_id: e.target.value})}
                                className="w-full border border-blue-200 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            >
                                <option value="">-- Select Destination --</option>
                                {branches.filter(b => b.id !== formData.source_branch_id).map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-bold text-gray-700 border-b pb-2">Item to Transfer</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Select Product</label>
                                <select 
                                    value={formData.product_id} 
                                    onChange={e => setFormData({...formData, product_id: e.target.value})}
                                    className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                >
                                    <option value="">-- Choose Item --</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                                <input 
                                    type="number" 
                                    min="1"
                                    value={formData.quantity} 
                                    onChange={e => setFormData({...formData, quantity: e.target.value})}
                                    className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-900" 
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button 
                            type="submit" 
                            disabled={isSubmitting} 
                            className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-md"
                        >
                            {isSubmitting ? 'Processing...' : 'Initiate Transfer'}
                        </button>
                    </div>
                </form>
            )}

            {/* --- TAB: INCOMING TRANSFERS --- */}
            {activeTab === 'INCOMING' && (
                <div className="animate-fade-in">
                    {incomingTransfers.length === 0 ? (
                        <div className="p-16 text-center text-gray-400">
                            <div className="text-4xl mb-3">📦</div>
                            <p>No incoming stock transfers await your approval.</p>
                        </div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-orange-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase">Ref ID</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase">From Branch</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase">Item Details</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase">Sent On</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-orange-800 uppercase">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {incomingTransfers.map(t => (
                                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-gray-500" title={t.id}>
                                            TRF-{String(t.id).slice(0, 6).toUpperCase()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                                            {t.source_branch_name}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-800">
                                            <span className="font-bold text-blue-600">{Number(t.quantity)}x</span> {t.product_name}
                                            {t.notes && <div className="text-xs text-gray-400 mt-1 italic">Note: {t.notes}</div>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {t.formatted_date}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <button 
                                                onClick={() => handleAcceptTransfer(t.id)}
                                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-bold text-sm shadow-sm transition-colors"
                                            >
                                                Accept Stock
                                            </button>
                                            
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <button 
                                                onClick={() => handleRejectTransfer(t.id)}
                                                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-bold text-sm shadow-sm transition-colors"
                                            >
                                                Reject Stock
                                            </button>
                                            
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* --- TAB: HISTORY --- */}
            {activeTab === 'HISTORY' && (
                <div className="overflow-x-auto animate-fade-in">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {transfers.length === 0 ? (
                                <tr><td colSpan={4} className="p-8 text-center text-gray-400">No transfer history available.</td></tr>
                            ) : (
                                transfers.map(t => (
                                    <tr key={t.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {t.formatted_date}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className="font-bold text-gray-900">{Number(t.quantity)}x</span> {t.product_name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className="font-medium text-gray-800">{t.source_branch_name}</span>
                                            <span className="text-gray-400 mx-2">→</span>
                                            <span className="font-medium text-gray-800">{t.destination_branch_name}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                                                t.status?.toLowerCase() === 'completed' ? 'bg-green-100 text-green-800' :
                                                (t.status?.toLowerCase() === 'pending' || t.status?.toLowerCase() === 'in_transit') ? 'bg-orange-100 text-orange-800' :
                                                t.status?.toLowerCase() === 'cancelled' ? 'bg-red-100 text-red-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                                {t.status || 'UNKNOWN'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

        </div>
      )}
    </div>
  );
};

export default StockTransfers;