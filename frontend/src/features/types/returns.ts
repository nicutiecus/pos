// types/returns.ts

export type ReturnCondition = 'restockable' | 'damaged';

export interface ReturnedGoodsPayload {
  receiptId: string;
  itemId: string;
  quantity: number;
  condition: ReturnCondition;
  refundAmount: number;
  notes: string;
  branch_id: string;
}

export interface ReturnedGoodsRecord extends ReturnedGoodsPayload {
  id: string;
  cashier_name: string;
  total_refund_amount: number;
  created_at: string;
  reason: string
}