import React, { useEffect, useState } from 'react';
import { type ReturnedGoodsRecord } from '../types/returns';

const ReturnedGoodsList: React.FC = () => {
  const [returns, setReturns] = useState<ReturnedGoodsRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Replace with your actual API call
    const fetchReturns = async () => {
      try {
        const response = await fetch('/api/returns');
        const data = await response.json();
        setReturns(data);
      } catch (error) {
        console.error('Error fetching returned goods', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReturns();
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <p className="text-gray-500 font-medium">Loading returned goods...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Returned Goods History</h2>
      
      <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm text-left">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 font-semibold text-gray-600">Date</th>
              <th className="px-6 py-3 font-semibold text-gray-600">Receipt ID</th>
              <th className="px-6 py-3 font-semibold text-gray-600">Item</th>
              <th className="px-6 py-3 font-semibold text-gray-600">Qty</th>
              <th className="px-6 py-3 font-semibold text-gray-600">Condition</th>
              <th className="px-6 py-3 font-semibold text-gray-600">Cashier</th>
              <th className="px-6 py-3 font-semibold text-gray-600">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {returns.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  No returns found.
                </td>
              </tr>
            ) : (
              returns.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-gray-700 whitespace-nowrap">
                    {new Date(record.dateReturned).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-gray-900 font-medium">{record.receiptId}</td>
                  <td className="px-6 py-4 text-gray-700">{record.itemName}</td>
                  <td className="px-6 py-4 text-gray-700">{record.quantity}</td>
                  <td className="px-6 py-4">
                    <span 
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                        record.condition === 'restockable' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {record.condition}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-700">{record.cashierName}</td>
                  <td className="px-6 py-4 text-gray-500 max-w-xs truncate" title={record.notes}>
                    {record.notes}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default ReturnedGoodsList