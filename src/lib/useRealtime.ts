import { useEffect, useRef, useState } from 'react';
import { invalidateApiCache } from './api';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

type Listener = () => void;
type StatusListener = (status: ConnectionStatus) => void;

class RealtimeMultiplexer {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<Listener>>();
  private statusListeners = new Set<StatusListener>();
  private status: ConnectionStatus = 'disconnected';
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private dirtyTables = new Set<string>();
  private reconnectAttempts = 0;
  private isDocumentVisible = typeof document !== 'undefined' ? document.visibilityState === 'visible' : true;

  constructor() {
    if (typeof window !== 'undefined') {
      // Listen for tab visibility changes to pause background queries and wake up on active
      document.addEventListener('visibilitychange', () => {
        this.isDocumentVisible = document.visibilityState === 'visible';
        if (this.isDocumentVisible && this.dirtyTables.size > 0) {
          // Trigger dirty tables when user comes back to the tab
          const tablesToFlush = Array.from(this.dirtyTables);
          this.dirtyTables.clear();
          tablesToFlush.forEach((table) => this.triggerListeners(table));
        }
      });

      // Listen to window online/offline
      window.addEventListener('online', () => {
        this.reconnectAttempts = 0;
        this.connect();
      });
      window.addEventListener('offline', () => {
        this.setStatus('disconnected');
        if (this.ws) {
          this.ws.close();
        }
      });
    }
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(status: ConnectionStatus) {
    if (this.status !== status) {
      this.status = status;
      this.statusListeners.forEach((l) => l(status));
    }
  }

  public subscribe(table: string, callback: Listener): () => void {
    if (!this.listeners.has(table)) {
      this.listeners.set(table, new Set());
    }
    this.listeners.get(table)!.add(callback);

    // Ensure connection is active
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
      this.connect();
    }

    return () => {
      const set = this.listeners.get(table);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.listeners.delete(table);
        }
      }
    };
  }

  private getWebSocketUrl(): string {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const wsBase = apiUrl
      ? apiUrl.replace(/^http/, 'ws')
      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/v1`;
    return `${wsBase}/ws`;
  }

  public connect() {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.setStatus('connecting');
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    try {
      const wsUrl = this.getWebSocketUrl();
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        this.setStatus('connected');
        this.reconnectAttempts = 0;
        this.startHeartbeat();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Handle heartbeat pong
          if (data.type === 'pong') {
            return;
          }

          if (data.event === 'postgres_changes') {
            const table = data.table || '*';
            // Automatically invalidate client in-memory cache for this table
            invalidateApiCache(table);
            this.scheduleDebouncedTrigger(table);
          }
        } catch (err) {
          console.warn('Realtime parse error', err);
        }
      };

      ws.onclose = () => {
        this.stopHeartbeat();
        this.setStatus('disconnected');
        this.scheduleReconnect();
      };

      ws.onerror = () => {
        this.stopHeartbeat();
        this.setStatus('disconnected');
      };
    } catch (e) {
      this.setStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    // Send ping every 25 seconds to keep Render free tier / proxy connection alive
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        } catch (e) {
          // ignore
        }
      }
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return;
    // Exponential backoff: 3s, 6s, 12s, max 20s
    this.reconnectAttempts++;
    const delay = Math.min(20000, 3000 * Math.pow(1.5, Math.min(this.reconnectAttempts, 4)));
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }

  private scheduleDebouncedTrigger(table: string) {
    if (!this.isDocumentVisible) {
      // Tab is in background: mark table as dirty and defer execution
      this.dirtyTables.add(table);
      this.dirtyTables.add('*');
      return;
    }

    // Debounce with jitter (350ms + 0-150ms random) to eliminate Thundering Herd across 30 devices
    const existing = this.debounceTimers.get(table);
    if (existing) {
      clearTimeout(existing);
    }

    const jitter = Math.floor(Math.random() * 150);
    const timer = setTimeout(() => {
      this.debounceTimers.delete(table);
      this.triggerListeners(table);
    }, 350 + jitter);

    this.debounceTimers.set(table, timer);
  }

  private triggerListeners(table: string) {
    // Notify table-specific listeners
    const tableSet = this.listeners.get(table);
    if (tableSet) {
      tableSet.forEach((cb) => {
        try {
          cb();
        } catch (e) {
          console.error(`Error in realtime listener for ${table}`, e);
        }
      });
    }

    // Also notify wildcard '*' listeners if not already the wildcard
    if (table !== '*') {
      const wildcardSet = this.listeners.get('*');
      if (wildcardSet) {
        wildcardSet.forEach((cb) => {
          try {
            cb();
          } catch (e) {
            console.error('Error in realtime wildcard listener', e);
          }
        });
      }
    }
  }
}

// Single instance across the entire browser tab
export const realtimeManager = new RealtimeMultiplexer();

/**
 * Subscribes to real-time changes via a shared WebSocket connection.
 * Automatically multiplexed, debounced, and pauses queries when tab is in background.
 */
export function useRealtime(table: string, onChange: () => void) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const unsubscribe = realtimeManager.subscribe(table, () => {
      onChangeRef.current();
    });

    return () => {
      unsubscribe();
    };
  }, [table]);
}

/**
 * Hook to read the current realtime WebSocket connection status.
 * Can be used by UI status badges / indicators.
 */
export function useConnectionStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>(realtimeManager.getStatus());

  useEffect(() => {
    const unsubscribe = realtimeManager.subscribeStatus(setStatus);
    return () => {
      unsubscribe();
    };
  }, []);

  return status;
}
