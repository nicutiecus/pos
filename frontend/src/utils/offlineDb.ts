import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface POSDB extends DBSchema {
  products: {
    key: number;
    value: any; // Replace with your Product interface
  };
  offline_orders: {
    key: string; // UUID for the order
    value: {
      id: string;
      payload: any; // The exact JSON payload you send to the backend
      timestamp: number;
    };
  };
}

const DB_NAME = 'equest-pos-db';
const DB_VERSION = 1;

export const initDB = async (): Promise<IDBPDatabase<POSDB>> => {
  return openDB<POSDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('products')) {
        db.createObjectStore('products', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('offline_orders')) {
        db.createObjectStore('offline_orders', { keyPath: 'id' });
      }
    },
  });
};

// --- Product Catalog Methods ---
export const saveProductsLocally = async (products: any[]) => {
  const db = await initDB();
  const tx = db.transaction('products', 'readwrite');
  await Promise.all(products.map(p => tx.store.put(p)));
  await tx.done;
};

export const getLocalProducts = async () => {
  const db = await initDB();
  return db.getAll('products');
};

// --- Offline Orders Methods ---
export const saveOfflineOrder = async (orderPayload: any) => {
  const db = await initDB();
  const orderId = crypto.randomUUID(); // Generate a unique ID for the offline queue
  await db.put('offline_orders', {
    id: orderId,
    payload: orderPayload,
    timestamp: Date.now(),
  });
  return orderId;
};

export const getOfflineOrders = async () => {
  const db = await initDB();
  return db.getAll('offline_orders');
};

export const removeOfflineOrder = async (id: string) => {
  const db = await initDB();
  await db.delete('offline_orders', id);
};