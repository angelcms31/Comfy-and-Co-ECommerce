import { useEffect, useRef, useState } from 'react';
import { getSavedSession } from '@/lib/session';

// FastAPI url (lib/http.ts), as a WebSocket url: http://host/api -> ws://host/api
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api';
const WS_URL = API_URL.replace(/^http/, 'ws');

export interface OrderEvent {
  type: 'order';
  event: string; // placed, status, shipped, delivered, failed_attempt, returned, received, payment, feedback, cancelled
  order_id: number;
  order_num: string;
  order_stat: string;
  at: string;
}

const RETRY_MS = [1000, 2000, 5000, 10000, 30000];

/**
 * Live order updates from the backend (app/events.py, routers/ws.py) over a WebSocket.
 * path: '/ws/orders/<id>', '/ws/me/orders' or '/ws/admin/orders'. Reconnects by itself with a growing delay;
 * stops for good when the server refuses the token (4401 / 4403 / 4404). Returns whether the socket is open,
 * so a page can fall back to polling while it isn't.
 */
export function useOrderEvents(path: string | null, onEvent: (e: OrderEvent) => void) {
  const [connected, setConnected] = useState(false);
  const latest = useRef(onEvent);
  latest.current = onEvent;

  useEffect(() => {
    if (!path) return;
    const token = getSavedSession()?.access_token;
    if (!token) return;

    let socket: WebSocket | null = null;
    let timer = 0;
    let attempt = 0;
    let closed = false;

    const connect = () => {
      if (closed) return;
      socket = new WebSocket(`${WS_URL}${path}?token=${encodeURIComponent(token)}`);
      socket.onopen = () => {
        attempt = 0;
        setConnected(true);
      };
      socket.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data as string) as OrderEvent | { type: 'ping' };
          if (data.type === 'order') latest.current(data);
        } catch {
          // not JSON, ignore
        }
      };
      socket.onclose = (e) => {
        setConnected(false);
        socket = null;
        // 44xx = the server said no (bad token, not your order, not an admin): retrying won't help
        if (closed || (e.code >= 4400 && e.code < 4500)) return;
        timer = window.setTimeout(connect, RETRY_MS[Math.min(attempt++, RETRY_MS.length - 1)]);
      };
      socket.onerror = () => socket?.close();
    };
    connect();

    return () => {
      closed = true;
      window.clearTimeout(timer);
      socket?.close();
    };
  }, [path]);

  return connected;
}
