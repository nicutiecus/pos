import React, { useState, useEffect } from 'react';
import api from '../../api/axiosInstance'; // Adjust path if necessary

// --- Interfaces ---
// Adjust these to match your exact Django model fields
interface InventoryLog {
  id: string | number;
  product_name: string;
  branch_name: string;
  transaction_type: 'ADD' | 'REMOVE' | 'SALE' | 'TRANSFER' | 'RETURN';
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reason: string;
  date: string;
  user_name: string;
}

const InventoryLogs: React.FC = () => {
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // --- Edit Modal State ---
  const [editingLog, setEditingLog] = useState<InventoryLog | null>(null);
  const [editReason, setEditReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Assuming your endpoint is /inventory/logs/
      const response = await api.get('/inventory/logs/');
      setLogs(response.data);
    } catch (err: any) {
      console.error("Failed to fetch inventory logs:", err);
      setError(err.response?.data?.message || "Failed to load inventory logs.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleEditClick = (log: InventoryLog) => {
    setEditingLog(log);
    setEditReason(log.reason || '');
  };

  const handleSaveEdit = async () => {
    if (!editingLog) return;
    setIsSaving(true);
    try {
      // Assuming your update endpoint allows PATCH to update the reason/notes
      await api.patch(`/inventory/logs/${editingLog.id}/`, {
        reason: editReason
      });
      
      // Update local state to reflect the change immediately
      setLogs(logs.map(log => 
        log.id === editingLog.id ? { ...log, reason: editReason } : log
      ));
      
      setEditingLog(null);
    } catch (err: any) {
      alert(`Failed to update log: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Filter by product name, branch, or reason
  const filteredLogs = logs.filter(log => 
    log.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.branch_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.reason && log.reason.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4">
      
      {/* HEADER & FILTERS */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">Inventory Logs</h2>
          <p className="text-sm text-gray-500">Audit trail of all stock movements and adjustments.</p>
        </div>
        
        <div className="w-full md:w-1/3">
          <input 
            type="text" 
            placeholder="Search products, branches, or reasons..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-3 pl-4 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow font-medium text-sm"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-sm">
          <p className="font-bold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* DATA TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center h-64 text-gray-500">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
             Loading logs...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date & Time</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Product & Branch</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Qty Change</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Reason / Notes</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400 font-medium">
                      No logs found matching "{searchTerm}"
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div>{new Date(log.date).toLocaleDateString()}</div>
                        <div className="text-xs text-gray-400">{new Date(log.date).toLocaleTimeString()}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">{log.product_name}</div>
                        <div className="text-xs text-gray-500">{log.branch_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                          log.transaction_type === 'ADD' ? 'bg-green-100 text-green-700' :
                          log.transaction_type === 'SALE' ? 'bg-blue-100 text-blue-700' :
                          log.transaction_type === 'REMOVE' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {log.transaction_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-black">
                        <span className={log.quantity > 0 ? 'text-green-600' : 'text-red-600'}>
                          {log.quantity > 0 ? '+' : ''}{log.quantity}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                        {log.reason || <span className="text-gray-400 italic">No notes provided</span>}
                        <div className="text-xs text-gray-400 mt-1">By: {log.user_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button 
                          onClick={() => handleEditClick(log)}
                          className="text-blue-600 hover:text-blue-800 font-bold text-sm bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded transition-colors"
                        >
                          Edit Note
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EDIT MODAL OVERLAY */}
      {editingLog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-down">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="font-black text-gray-800 text-lg">Edit Log Entry</h3>
              <button onClick={() => setEditingLog(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-3 rounded-lg border border-gray-100">
                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase">Product</span>
                  <span className="font-semibold text-gray-800">{editingLog.product_name}</span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase">Type</span>
                  <span className="font-semibold text-gray-800">{editingLog.transaction_type} ({editingLog.quantity > 0 ? '+' : ''}{editingLog.quantity})</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Correction Reason / Notes</label>
                <textarea 
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none h-24"
                  placeholder="Enter the reason for this adjustment..."
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button 
                onClick={() => setEditingLog(null)}
                className="px-4 py-2 font-bold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryLogs;