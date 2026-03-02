import React from 'react';

// --- Interfaces ---
export interface ReceiptItem {
  product_name: string;
  quantity: number | string;
  unit_price: number | string;
  total: number | string;
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
  subtotal: number | string;
  tax: number | string; // If applicable
  total: number | string;
  amountPaid: number | string;
  change: number | string; // or Balance
  paymentMethod: string;
}

interface Props {
  data: ReceiptData | null;
}

// --- Bulletproof Helpers ---
// 1. Safely parses ANY string with commas or weird characters into a clean number
const safeNum = (val: any): number => {
  if (val === undefined || val === null) return 0;
  // Convert to string, remove commas, then parse to float
  const parsed = parseFloat(String(val).replace(/,/g, ''));
  return isNaN(parsed) ? 0 : parsed;
};

// 2. Safely parses dates, falls back to right NOW if the backend date is missing/invalid
const safeDate = (dateStr: any): Date => {
  if (!dateStr) return new Date();
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
};

// We use forwardRef because react-to-print needs to access the DOM node
export const ReceiptTemplate = React.forwardRef<HTMLDivElement, Props>(({ data }, ref) => {
  if (!data) return null;

  // --- Clean the Data Before Rendering ---
  const parsedDate = safeDate(data.date);
  const amountPaid = safeNum(data.amountPaid);
  
  // Calculate a foolproof total just in case the parent passed a bad total
  let safeTotal = safeNum(data.total);
  if (safeTotal === 0 && data.items && data.items.length > 0) {
      safeTotal = data.items.reduce((sum, item) => sum + (safeNum(item.quantity) * safeNum(item.unit_price)), 0);
  }
  
  // Calculate the correct change safely
  const actualChange = amountPaid - safeTotal;

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
          <span>Date: {parsedDate.toLocaleDateString()}</span>
          <span>Time: {parsedDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
        </div>
        <div className="flex justify-between">
          <span>Rect #: {data.receiptNumber || 'N/A'}</span>
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
          {data.items.map((item, idx) => {
             const qty = safeNum(item.quantity);
             const price = safeNum(item.unit_price);
             const itemTotal = qty * price; // Force recalculation per item to prevent NaN

             return (
               <tr key={idx}>
                 <td className="py-1 align-top pr-1">{item.product_name}</td>
                 <td className="py-1 align-top text-center">{qty}</td>
                 <td className="py-1 align-top text-right">{price.toLocaleString()}</td>
                 <td className="py-1 align-top text-right font-bold">{itemTotal.toLocaleString()}</td>
               </tr>
             );
          })}
        </tbody>
      </table>

      {/* TOTALS */}
      <div className="border-t border-black border-dashed pt-2 mb-4">
        <div className="flex justify-between font-bold text-sm">
          <span>TOTAL</span>
          <span>₦{safeTotal.toLocaleString()}</span>
        </div>
        
        <div className="mt-2 text-[10px] space-y-1">
          <div className="flex justify-between">
            <span>Paid ({data.paymentMethod}):</span>
            <span>₦{amountPaid.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>{amountPaid < safeTotal ? 'Balance Due:' : 'Change:'}</span>
            <span>₦{Math.abs(actualChange).toLocaleString()}</span>
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