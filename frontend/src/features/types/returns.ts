// types/returns.ts

export type ReturnCondition = 'restockable' | 'damaged';

export interface ReturnedGoodsPayload {
  receiptId: string;
  itemId: string;
  quantity: number;
  condition: ReturnCondition;
  refundAmount: number;
  notes: string;
}

export interface ReturnedGoodsRecord extends ReturnedGoodsPayload {
  id: string;
  itemName: string;
  dateReturned: string;
  cashierName: string;
  refundAmount: number;
}