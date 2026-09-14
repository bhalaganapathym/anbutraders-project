/**
 * Offline Outbox Queue using Native IndexedDB
 * 
 * Stores mutating API requests when the device is offline or experiencing network drops.
 * Automatically replays them in chronological order once online, using client-generated
 * Idempotency Keys to eliminate duplicate records.
 */

export interface QueuedRequest {
  id: string;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  idempotencyKey: string;
  description: string;
  createdAt: number;
  status: 'pending' | 'syncing' | 'failed';
  error?: string;
}

const DB_NAME = 'anbu_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'outbox';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'req-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
}

export async function enqueueRequest(
  item: Omit<QueuedRequest, 'id' | 'createdAt' | 'status'>
): Promise<QueuedRequest> {
  const db = await openDb();
  const queuedItem: QueuedRequest = {
    ...item,
    id: generateUuid(),
    createdAt: Date.now(),
    status: 'pending'
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(queuedItem);
    req.onsuccess = () => {
      notifyQueueChange();
      resolve(queuedItem);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getQueuedRequests(): Promise<QueuedRequest[]> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result || []) as QueuedRequest[];
        // Sort chronologically (FIFO)
        list.sort((a, b) => a.createdAt - b.createdAt);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    return [];
  }
}

export async function removeQueuedRequest(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => {
      notifyQueueChange();
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function clearAllQueuedRequests(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => {
      notifyQueueChange();
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

// Listeners for queue size changes
type QueueListener = (count: number) => void;
const queueListeners = new Set<QueueListener>();

export function subscribeQueueCount(listener: QueueListener): () => void {
  queueListeners.add(listener);
  getQueuedRequests().then((items) => listener(items.length));
  return () => queueListeners.delete(listener);
}

function notifyQueueChange() {
  getQueuedRequests().then((items) => {
    queueListeners.forEach((l) => l(items.length));
  });
}

let isReplaying = false;

/**
 * Replays all pending offline requests in chronological order with 250ms spacing
 * to avoid CPU bursts on Render Free Tier.
 */
export async function replayOfflineQueue(): Promise<{ synced: number; failed: number }> {
  if (isReplaying || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return { synced: 0, failed: 0 };
  }
  isReplaying = true;

  let synced = 0;
  let failed = 0;

  try {
    const items = await getQueuedRequests();
    if (items.length === 0) {
      isReplaying = false;
      return { synced: 0, failed: 0 };
    }

    for (const item of items) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Idempotency-Key': item.idempotencyKey,
          ...(item.headers || {})
        };
        const token = localStorage.getItem('token') || localStorage.getItem('access_token');
        if (token && !headers['Authorization']) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(item.url, {
          method: item.method,
          headers,
          body: item.body ? JSON.stringify(item.body) : undefined
        });

        if (res.ok) {
          await removeQueuedRequest(item.id);
          synced++;
        } else if (res.status >= 400 && res.status < 500) {
          // Client error (validation / business logic): remove from queue to prevent poison pill
          console.warn(`Offline item ${item.id} rejected with ${res.status}`, await res.text());
          await removeQueuedRequest(item.id);
          failed++;
        } else {
          // Server error: keep in queue for next retry
          failed++;
          break; // Stop replaying on 5xx to avoid pounding a recovering server
        }
      } catch (e) {
        failed++;
        break; // Network still disconnected
      }

      // 250ms spacing between replays
      await new Promise((r) => setTimeout(r, 250));
    }
  } finally {
    isReplaying = false;
    notifyQueueChange();
  }

  return { synced, failed };
}

// Auto-sync when device comes back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    // Wait 1.5s after network returns before replaying
    setTimeout(() => {
      replayOfflineQueue();
    }, 1500);
  });
}
