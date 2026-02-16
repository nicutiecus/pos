import React, { useState, useEffect } from 'react';
import api from '../../../api/axiosInstance';

interface TransferRequest {
  id: number;
  product_name: string;
  quantity: number;
  from_branch_name: string;
  initiated_at: string;
  notes: string;
  status: 'PENDING' | 'COMPLETED';
}

const IncomingTransfers: React.FC = () => {
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    fetchIncoming();
  }, []);

  const fetchIncoming = async () => {
    try {
      const res = await api.get('/transfers/incoming'); // Endpoint filtering for status=PENDING
      setTransfers(res.data);
    } catch (err) {
      console.error("Failed to load incoming transfers", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcknowledge = async (id: number) => {
    if (!window.confirm("Confirm you have physically received these items?")) return;
    
    setProcessingId(id);
    try {
      await api.post(`/transfers/${id}/acknowledge`);
      // Remove from list immediately on success
      setTransfers(transfers.filter(t => t.id !== id));
      alert("Stock received and added to inventory!");
    } catch (err) {
      alert("Failed to acknowledge transfer.");
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) return <div className="text-gray-500 text-sm">Checking for incoming stock...</div>;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-bold text-gray-800">Incoming Stock Requests</h3>
        <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-1 rounded-full">
          {transfers.length} Pending
        </span>
      </div>

      {transfers.length === 0 ? (
        <div className="p-8 text-center text-gray-500 text-sm">
          No pending transfers from other branches.
        </div>
      ) : (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">From</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {transfers.map((t) => (
              <tr key={t.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{t.from_branch_name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{t.product_name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-bold">{t.quantity}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(t.initiated_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <button
                    onClick={() => handleAcknowledge(t.id)}
                    disabled={processingId === t.id}
                    className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-xs font-medium disabled:opacity-50 transition-colors"
                  >
                    {processingId === t.id ? 'Processing...' : 'Acknowledge Receipt'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default IncomingTransfers;