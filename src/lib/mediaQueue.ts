/**
 * Local Media Blob Storage & Resumable Auto-Retry
 * 
 * Saves photos and voice notes locally in IndexedDB first so:
 * 1. The UI renders the image or audio instantly (0ms lag) via URL.createObjectURL
 * 2. If the mobile 4G/Wi-Fi connection drops in the yard, the photo is NEVER lost
 * 3. Background worker automatically uploads the blob when connection recovers
 */

import { compressImage } from './imageCompressor';

export interface QueuedMedia {
  id: string;
  endpoint: string;
  blob: Blob;
  fileName: string;
  fileType: string;
  caption?: string;
  createdAt: number;
  retryCount: number;
  status: 'pending' | 'uploading' | 'failed';
}

const DB_NAME = 'anbu_media_db';
const DB_VERSION = 1;
const STORE_NAME = 'media_files';

function openMediaDb(): Promise<IDBDatabase> {
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

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'media-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
}

export async function saveMediaLocally(
  blob: Blob,
  fileName: string,
  endpoint: string,
  caption?: string
): Promise<{ id: string; localUrl: string }> {
  const db = await openMediaDb();
  const id = generateId();
  const item: QueuedMedia = {
    id,
    endpoint,
    blob,
    fileName,
    fileType: blob.type,
    caption,
    createdAt: Date.now(),
    retryCount: 0,
    status: 'pending'
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  const localUrl = URL.createObjectURL(blob);
  return { id, localUrl };
}

export async function removeLocalMedia(id: string): Promise<void> {
  try {
    const db = await openMediaDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to remove local media', err);
  }
}

export async function getPendingMedia(): Promise<QueuedMedia[]> {
  try {
    const db = await openMediaDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    return [];
  }
}

let isMediaSyncing = false;

/**
 * Replays and uploads any pending media blobs in the background.
 */
export async function retryPendingMediaUploads(): Promise<number> {
  if (isMediaSyncing || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return 0;
  }
  isMediaSyncing = true;
  let uploaded = 0;

  try {
    const items = await getPendingMedia();
    const apiUrl = import.meta.env.VITE_API_URL || 
      (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app') 
        ? 'https://anbutraders-project.onrender.com/api/v1' 
        : '/api');

    for (const item of items) {
      try {
        const file = new File([item.blob], item.fileName, { type: item.fileType });
        const formData = new FormData();
        formData.append('file', file);
        if (item.caption) formData.append('caption', item.caption);

        const token = localStorage.getItem('token') || localStorage.getItem('access_token');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${apiUrl}${item.endpoint}`, {
          method: 'POST',
          headers,
          body: formData
        });

        if (res.ok) {
          await removeLocalMedia(item.id);
          uploaded++;
        }
      } catch (err) {
        // Network failed, keep in storage for next retry
        break;
      }
      await new Promise((r) => setTimeout(r, 400));
    }
  } finally {
    isMediaSyncing = false;
  }

  return uploaded;
}

// Auto-upload pending media when online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    setTimeout(() => {
      retryPendingMediaUploads();
    }, 2000);
  });
}
