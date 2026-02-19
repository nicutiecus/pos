import React from 'react';

// --- Interfaces ---
export interface ReceiptItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface ReceiptData {
  businessName: string;
  branchName: string;
  address?: string;
  phone?: string;
  receiptNumber: string;
  date: string;
  cashierName: string;
  customerName?: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number; // If applicable
  total: number;
  amountPaid: number;
  change: number; // or Balance
  paymentMethod: string;
}

interface Props {
  data: ReceiptData | null;
}

// We use forwardRef because react-to-print needs to access the DOM node
export const ReceiptTemplate = React.forwardRef<HTMLDivElement, Props>(({ data }, ref) => {
  if (!data) return null;

  return (
    <div ref={ref} className="receipt-container p-2 text-xs font-mono text-black bg-white" style={{ width: '80mm' }}>
      
      {/* HEADER */}
      <div className="text-center mb-4 border-b border-black pb-2 border-dashed">
        <h1 className="text-xl font-bold uppercase">{data.businessName}</h1>
        <p className="text-[10px]">{data.branchName}</p>
        {data.address && <p className="text-[10px]">{data.address}</p>}
        {data.phone && <p className="text-[10px]">Tel: {data.phone}</p>}
      </div>

      {/* META INFO */}
      <div className="mb-2 text-[10px]">
        <div className="flex justify-between">
          <span>Date: {new Date(data.date).toLocaleDateString()}</span>
          <span>Time: {new Date(data.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
        </div>
        <div className="flex justify-between">
          <span>Rect #: {data.receiptNumber}</span>
          <span>Cashier: {data.cashierName}</span>
        </div>
        {data.customerName && (
           <div className="mt-1 font-bold border-t border-black pt-1 border-dashed">
             Customer: {data.customerName}
           </div>
        )}
      </div>

      {/* ITEMS TABLE */}
      <table className="w-full text-left mb-2 border-collapse">
        <thead>
          <tr className="border-b border-black border-dashed">
            <th className="py-1 w-1/2">Item</th>
            <th className="py-1 text-center">Qty</th>
            <th className="py-1 text-right">Price</th>
            <th className="py-1 text-right">Amt</th>
          </tr>
        </thead>
        <tbody className="text-[10px]">
          {data.items.map((item, idx) => (
            <tr key={idx}>
              <td className="py-1 align-top pr-1">{item.product_name}</td>
              <td className="py-1 align-top text-center">{item.quantity}</td>
              <td className="py-1 align-top text-right">{item.unit_price.toLocaleString()}</td>
              <td className="py-1 align-top text-right font-bold">{item.total.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* TOTALS */}
      <div className="border-t border-black border-dashed pt-2 mb-4">
        <div className="flex justify-between font-bold text-sm">
          <span>TOTAL</span>
          <span>₦{data.total.toLocaleString()}</span>
        </div>
        
        <div className="mt-2 text-[10px] space-y-1">
          <div className="flex justify-between">
            <span>Paid ({data.paymentMethod}):</span>
            <span>₦{data.amountPaid.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>{data.amountPaid < data.total ? 'Balance Due:' : 'Change:'}</span>
            <span>₦{Math.abs(data.change).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="text-center text-[10px] mt-6">
        <p>*** THANK YOU ***</p>
        <p>Goods bought in good condition cannot be returned.</p>
        <p className="mt-2 text-[8px] text-gray-500">Powered by Equest POS</p>
      </div>
      
    </div>
  );
});

ReceiptTemplate.displayName = "ReceiptTemplate";