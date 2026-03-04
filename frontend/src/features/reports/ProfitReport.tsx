import React, { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';

// --- Interfaces matching your EXACT Django JSON ---
interface Timeframe {
  start: string;
  end: string;
}

interface OverallMetrics {
  total_items_sold: number;
  gross_revenue: number;
  total_discount_given: number;
  net_revenue: number;
  gross_cost: number;
  net_profit: number;
}

// Note: Adjust these keys if your Django backend names them slightly differently in the breakdown array
interface ProductBreakdown {
  product_name?: string;
  quantity_sold?: number;
  gross_revenue?: number;
  gross_profit?: number;
}

interface ProfitReportResponse {
  timeframe: Timeframe;
  overall_metrics: OverallMetrics;
  product_breakdown: ProductBreakdown[];
}

const ProfitReport: React.FC = () => {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const currentDate = today.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(currentDate);
  
  const [reportData, setReportData] = useState<ProfitReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfits = async () => {
    if (!startDate || !endDate) {
      setError("Please select both a start and end date.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get(`/reports/profits/?start_date=${startDate}&end_date=${endDate}`);
      setReportData(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to fetch profit data. Please try again.");
      setReportData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Safe fallback to prevent NaN if revenue is 0
  const profitMargin = reportData?.overall_metrics.net_revenue 
    ? (reportData.overall_metrics.net_profit / reportData.overall_metrics.net_revenue) * 100 
    : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4">
      
      {/* HEADER & FILTERS */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">Profitability Report</h2>
          <p className="text-sm text-gray-500">Analyze net revenue, costs, and item performance.</p>
        </div>
        
        <div className="flex items-end gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Start Date</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              className="p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">End Date</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              className="p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
            />
          </div>
          <button 
            onClick={fetchProfits}
            disabled={isLoading}
            className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors h-[38px] flex items-center shadow-sm"
          >
            {isLoading ? 'Loading...' : 'Run Report'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-sm">
          <p className="font-bold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {!isLoading && reportData && (
        <div className="space-y-6 animate-fade-in-down">
          
          {/* TOP SUMMARY CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Gross Revenue & Discounts */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Gross Revenue</p>
                <h3 className="text-2xl font-black text-gray-900">
                  ₦{reportData.overall_metrics.gross_revenue?.toLocaleString() || '0'}
                </h3>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center text-sm">
                <span className="text-gray-500">Discounts Given:</span>
                <span className="font-bold text-orange-500">- ₦{reportData.overall_metrics.total_discount_given?.toLocaleString() || '0'}</span>
              </div>
            </div>

            {/* Net Revenue */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 border-t-4 border-t-blue-500">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Net Revenue</p>
              <h3 className="text-3xl font-black text-blue-600">
                ₦{reportData.overall_metrics.net_revenue?.toLocaleString() || '0'}
              </h3>
              <p className="text-xs text-gray-400 mt-2">Actual collected after discounts.</p>
            </div>

            {/* Cost of Goods */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 border-t-4 border-t-red-500">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Cost of Goods (COGS)</p>
              <h3 className="text-3xl font-black text-gray-900">
                ₦{reportData.overall_metrics.gross_cost?.toLocaleString() || '0'}
              </h3>
              <p className="text-xs text-gray-400 mt-2">For {reportData.overall_metrics.total_items_sold} items sold.</p>
            </div>

            {/* Net Profit & Margin */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 border-t-4 border-t-green-500 relative overflow-hidden">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Net Profit</p>
              <h3 className={`text-3xl font-black ${reportData.overall_metrics.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ₦{reportData.overall_metrics.net_profit?.toLocaleString() || '0'}
              </h3>
              <div className="mt-3">
                <span className={`text-xs font-bold px-2 py-1 rounded ${profitMargin >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {profitMargin.toFixed(1)}% Margin
                </span>
              </div>
            </div>

          </div>

          {/* PRODUCT BREAKDOWN TABLE */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
               <h3 className="font-bold text-gray-800">Product Performance Breakdown</h3>
               <span className="text-xs font-bold text-gray-500 bg-white px-2 py-1 rounded border border-gray-200 shadow-sm">
                 {reportData.product_breakdown?.length || 0} Products
               </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-white">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Qty Sold</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Revenue</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Cost</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Profit</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {reportData.product_breakdown?.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-400">No product sales found for this period.</td>
                    </tr>
                  ) : (
                    reportData.product_breakdown?.map((item, idx) => {
                      // Dynamically grabbing values depending on exactly how Django named them
                      const name = item.product_name || 0;
                      const qty = item.quantity_sold || 0;
                      const rev = Number(item.gross_revenue) || 0;
                      const profit = Number(item.gross_profit) || 0 ;
                        const cost = rev-profit;

                      return (
                        <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right font-medium">{qty}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 text-right font-bold">₦{rev.toLocaleString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-red-500 text-right font-medium">₦{cost.toLocaleString()}</td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-black ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ₦{profit.toLocaleString()}
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
      )}
    </div>
  );
};

export default ProfitReport;