import { useEffect, useRef } from 'react';

/**
 * Subscribes to real-time changes via FastAPI WebSocket and calls `onChange`
 * whenever a Postgres table changes.
 */
export function useRealtime(table: string, onChange: () => void) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const wsBase = apiUrl 
      ? apiUrl.replace(/^http/, 'ws') 
      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/v1`;
    const wsUrl = `${wsBase}/ws`;
    
    let ws: WebSocket;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    
    const connect = () => {
      ws = new WebSocket(wsUrl);
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (table === '*' || (data.event === 'postgres_changes' && data.table === table)) {
            onChangeRef.current();
          }
        } catch (e) {
          console.error('WebSocket parse error', e);
        }
      };

      ws.onclose = () => {
        // Reconnect after 3s
        reconnectTimeout = setTimeout(connect, 3000);
      };
    };
    
    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [table]);
}
