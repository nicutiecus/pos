import React, { useEffect, useState } from 'react';
import api from '../../api/axiosInstance';

interface SaleItem {
  product_name: string;
  quantity: number;
  unit_price: string;
  total: number;
}

interface Sale {
  id: number;
  receipt_number: string;
  created_at: string;
  total_amount: string;
  payment_method: string;
  items: SaleItem[];
}

const SalesHistory: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSaleId, setExpandedSaleId] = useState<number | null>(null);

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    try {
      // Fetch sales for TODAY or CURRENT SHIFT
      const res = await api.get('/sales/list?limit=20');
      setSales(res.data);
    } catch (err) {
      console.error("Failed to load sales history", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = (sale: Sale) => {
    alert(`Printing Receipt #${sale.receipt_number}... \n(Integration with thermal printer would happen here)`);
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading Sales Records...</div>;

  return (
    <div className="bg-white h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <h2 className="font-bold text-gray-800 text-lg">Recent Transactions</h2>
        <button onClick={fetchSales} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
          ↻ Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sales.length === 0 ? (
          <div className="p-10 text-center text-gray-400">No sales recorded today.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Receipt #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {sales.map((sale) => (
                <React.Fragment key={sale.id}>
                  <tr 
                    onClick={() => setExpandedSaleId(expandedSaleId === sale.id ? null : sale.id)}
                    className={`cursor-pointer hover:bg-blue-50 transition-colors ${expandedSaleId === sale.id ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-600">
                      {sale.receipt_number}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${
                        sale.payment_method === 'CASH' ? 'bg-green-100 text-green-700 border-green-200' :
                        sale.payment_method === 'POS' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                        'bg-purple-100 text-purple-700 border-purple-200'
                      }`}>
                        {sale.payment_method}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-bold text-right">
                      ₦{Number(sale.total_amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handlePrint(sale); }}
                        className="text-gray-400 hover:text-gray-800"
                      >
                        🖨️
                      </button>
                    </td>
                  </tr>
                  
                  {/* EXPANDED DETAILS */}
                  {expandedSaleId === sale.id && (
                    <tr className="bg-gray-50">
                      <td colSpan={5} className="p-4 border-b border-gray-100 shadow-inner">
                        <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Items Purchased</div>
                        <ul className="space-y-1">
                          {sale.items.map((item, idx) => (
                            <li key={idx} className="flex justify-between text-sm text-gray-700">
                              <span>{item.quantity}x {item.product_name}</span>
                              <span className="font-mono text-gray-500">₦{Number(item.total).toLocaleString()}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default SalesHistory;