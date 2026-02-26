import { useEffect, useRef, useState, useCallback } from 'react';
import { WSMessage, WSMessageType } from '@/types';

interface UseWebSocketOptions {
  url: string;
  onMessage?: (message: WSMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface UseWebSocketReturn {
  sendMessage: (message: WSMessage) => void;
  isConnected: boolean;
  isConnecting: boolean;
  disconnect: () => void;
  reconnect: () => void;
}

export function useWebSocket({
  url,
  onMessage,
  onOpen,
  onClose,
  onError,
  reconnectInterval = 3000,
  maxReconnectAttempts = 5,
}: UseWebSocketOptions): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  // When true, the disconnect was intentional — skip auto-reconnect.
  const intentionalDisconnectRef = useRef(false);
  // Stable ref to always call the latest `connect` with reconnect logic.
  const connectRef = useRef<() => void>(() => {});
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Keep callback refs stable so they never invalidate the connect() closure.
  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  const onErrorRef = useRef(onError);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onOpenRef.current = onOpen; }, [onOpen]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  // connect/disconnect are now stable (only depend on url + scalar config)
  // because callbacks are accessed via refs.
  const connect = useCallback(() => {
    if (!url) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // Reset flags for this explicit connection attempt.
    intentionalDisconnectRef.current = false;
    reconnectAttemptsRef.current = 0;
    setIsConnecting(true);
    console.log(`🔗 Attempting WebSocket connection (${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts + 1}): ${url}`);

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        setIsConnecting(false);
        reconnectAttemptsRef.current = 0;
        onOpenRef.current?.();
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          onMessageRef.current?.(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('📴 WebSocket disconnected');
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;
        onCloseRef.current?.();

        // Attempt reconnect only if this was NOT an intentional disconnect.
        if (!intentionalDisconnectRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(
            `🔄 Reconnecting... Attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts}`
          );
          reconnectTimeoutRef.current = setTimeout(() => {
            connectRef.current();
          }, reconnectInterval);
        } else if (!intentionalDisconnectRef.current) {
          console.error(`❌ WebSocket: gave up after ${maxReconnectAttempts} attempts to connect to ${url}. Make sure the WS server is running: bun run dev`);
        }
      };

      ws.onerror = (event) => {
        console.warn(`⚠️ WebSocket connection error (${url}). Is the WS server running? Start with: bun run dev`);
        console.warn('Error details:', event);
        setIsConnecting(false);
        onErrorRef.current?.(event);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setIsConnecting(false);
    }
  }, [url, reconnectInterval, maxReconnectAttempts]);

  // Keep connectRef pointing to the latest connect so the onclose timer
  // always calls the most-recent version of connect.
  useEffect(() => { connectRef.current = connect; }, [connect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    intentionalDisconnectRef.current = true; // Prevent auto-reconnect on close

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const reconnect = useCallback(() => {
    intentionalDisconnectRef.current = true; // stop any in-flight reconnect timers
    disconnect();
    connect();
  }, [connect, disconnect]);

  const sendMessage = useCallback((message: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected. Message not sent:', message);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return; // SSR guard
    
    console.log(`🔧 useWebSocket initialized with URL: ${url}`);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect, url]);

  // Heartbeat
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      sendMessage({ type: WSMessageType.PING, payload: {} });
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [isConnected, sendMessage]);

  return {
    sendMessage,
    isConnected,
    isConnecting,
    disconnect,
    reconnect,
  };
}
