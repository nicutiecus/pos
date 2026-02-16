import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

// --- Interfaces ---
export interface CartItem {
  id: number;
  name: string;
  price: number; // Store as number for math, format as string for display
  quantity: number;
  sku: string;
}

interface CartState {
  items: CartItem[];
  totalAmount: number;
  totalQuantity: number;
}

// --- Initial State ---
// We try to load from LocalStorage first so the cart survives a page refresh
const loadCartFromStorage = (): CartState => {
  const stored = localStorage.getItem('pos_cart');
  if (stored) {
    return JSON.parse(stored);
  }
  return { items: [], totalAmount: 0, totalQuantity: 0 };
};

const initialState: CartState = loadCartFromStorage();

// --- Slice ---
const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    // 1. ADD ITEM (Handle new vs existing)
    addToCart: (state, action: PayloadAction<Omit<CartItem, 'quantity'>>) => {
      const newItem = action.payload;
      const existingItem = state.items.find((item) => item.id === newItem.id);

      if (existingItem) {
        existingItem.quantity++;
      } else {
        state.items.push({
          ...newItem,
          quantity: 1, // Default to 1
        });
      }
      
      // Update Totals
      state.totalQuantity++;
      state.totalAmount += newItem.price;
      
      // Save to Storage
      localStorage.setItem('pos_cart', JSON.stringify(state));
    },

    // 2. REMOVE ITEM (Completely)
    removeFromCart: (state, action: PayloadAction<number>) => {
      const id = action.payload;
      const existingItem = state.items.find((item) => item.id === id);

      if (existingItem) {
        state.totalQuantity -= existingItem.quantity;
        state.totalAmount -= existingItem.price * existingItem.quantity;
        state.items = state.items.filter((item) => item.id !== id);
      }
      
      localStorage.setItem('pos_cart', JSON.stringify(state));
    },

    // 3. DECREASE QUANTITY (Remove if hits 0)
    decreaseQuantity: (state, action: PayloadAction<number>) => {
      const id = action.payload;
      const existingItem = state.items.find((item) => item.id === id);

      if (existingItem) {
        if (existingItem.quantity === 1) {
          // Remove completely if qty is 1
          state.items = state.items.filter((item) => item.id !== id);
        } else {
          existingItem.quantity--;
        }
        state.totalQuantity--;
        state.totalAmount -= existingItem.price;
      }
      
      localStorage.setItem('pos_cart', JSON.stringify(state));
    },

    // 4. CLEAR CART (After checkout)
    clearCart: (state) => {
      state.items = [];
      state.totalAmount = 0;
      state.totalQuantity = 0;
      localStorage.removeItem('pos_cart');
    },
  },
});

export const { addToCart, removeFromCart, decreaseQuantity, clearCart } = cartSlice.actions;
export default cartSlice.reducer;