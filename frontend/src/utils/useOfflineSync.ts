import { useEffect } from 'react';
import api from '../api/axiosInstance';
import { getOfflineOrders, removeOfflineOrder } from './offlineDb';

export const useOfflineSync = () => {
  useEffect(() => {
    const syncOrders = async () => {
      const pendingOrders = await getOfflineOrders();
      
      if (pendingOrders.length === 0) return;

      console.log(`Attempting to sync ${pendingOrders.length} offline orders...`);

      for (const order of pendingOrders) {
        try {
          // Send the exact payload to your Django checkout endpoint
          await api.post('/sales/create/', order.payload);
          
          // If successful, remove it from the local offline queue
          await removeOfflineOrder(order.id);
          console.log(`Order ${order.id} synced successfully.`);
        } catch (err: any) {
          console.error(`Failed to sync order ${order.id}`, err);
          // If it fails (e.g., server validation error), it stays in IndexedDB to be retried
        }
      }
    };

    // 1. Listen for the moment the internet comes back
    window.addEventListener('online', syncOrders);

    // 2. Also try to sync every time the app loads (if already online)
    if (navigator.onLine) {
      syncOrders();
    }

    return () => {
      window.removeEventListener('online', syncOrders);
    };
  }, []);
};