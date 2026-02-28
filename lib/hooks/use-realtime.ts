/**
 * Supabase Realtime hook — drop-in replacement for useWebSocket.
 *
 * Subscribes to the `session:{sessionId}` broadcast channel.
 * On first connection it fetches the current visible messages and emits a
 * synthetic SESSION_JOINED event so pages that already handle that case
 * continue to work without modification.
 *
 * Features:
 *  - Auto-reconnect with exponential back-off (2 s → 4 s → 8 s … max 30 s)
 *  - Page-visibility reconnect: reconnects when the tab comes back into focus
 *  - Manual connect / disconnect toggle via disconnect() / reconnect()
 *
 * Message sending (SEND_MESSAGE) is handled via HTTP POST /api/messages
 * in page components — the hook itself is receive-only.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { WSMessage, WSMessageType } from '@/types';
import { Message } from '@/types';

const BACKOFF_DELAYS = [2000, 4000, 8000, 15000, 30000]; // ms

export interface UseRealtimeOptions {
  /** The Prisma session ID — used to name the Supabase channel. Pass an
   *  empty string (or omit) while the session is still loading; the hook
   *  will subscribe automatically once a non-empty value is provided. */
  sessionId: string;
  onMessage?: (message: WSMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export interface UseRealtimeReturn {
  isConnected: boolean;
  isConnecting: boolean;
  /** No-op — kept for API compatibility with the old useWebSocket hook.
   *  Outbound messages are sent via HTTP POST /api/messages. */
  sendMessage: (message: WSMessage) => void;
  disconnect: () => void;
  reconnect: () => void;
}

export function useRealtime({
  sessionId,
  onMessage,
  onOpen,
  onClose,
}: UseRealtimeOptions): UseRealtimeReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const sessionIdRef = useRef(sessionId);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** True when the user explicitly called disconnect() — suppresses auto-reconnect. */
  const manuallyDisconnectedRef = useRef(false);

  // Keep callback refs fresh so the subscription closure never sees stale values.
  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onOpenRef.current = onOpen; }, [onOpen]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const removeChannel = useCallback(() => {
    if (channelRef.current) {
      try {
        const supabase = getSupabaseBrowserClient();
        supabase.removeChannel(channelRef.current);
      } catch { /* ignore */ }
      channelRef.current = null;
    }
  }, []);

  // Forward-declare so subscribe can reference it for retry scheduling.
  const scheduleRetry = useCallback((id: string) => {
    clearRetryTimer();
    const delay = BACKOFF_DELAYS[Math.min(retryCountRef.current, BACKOFF_DELAYS.length - 1)];
    retryCountRef.current += 1;
    retryTimerRef.current = setTimeout(() => {
      if (!manuallyDisconnectedRef.current && sessionIdRef.current === id) {
        subscribe(id); // eslint-disable-line @typescript-eslint/no-use-before-define
      }
    }, delay);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearRetryTimer]);

  const subscribe = useCallback((id: string) => {
    if (!id || typeof window === 'undefined') return;

    removeChannel();
    setIsConnecting(true);

    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel(`session:${id}`)
      .on('broadcast', { event: 'new_message' }, ({ payload }) => {
        onMessageRef.current?.({
          type: WSMessageType.NEW_MESSAGE,
          payload: payload as Message,
        });
      })
      .on('broadcast', { event: 'message_updated' }, ({ payload }) => {
        onMessageRef.current?.({
          type: WSMessageType.MESSAGE_UPDATED,
          payload: payload as { messageId: string; isVisible?: boolean; isPinned?: boolean },
        });
      })
      .on('broadcast', { event: 'message_deleted' }, ({ payload }) => {
        onMessageRef.current?.({
          type: WSMessageType.MESSAGE_DELETED,
          payload: payload as { messageId: string },
        });
      })
      .on('broadcast', { event: 'all_messages_cleared' }, ({ payload }) => {
        onMessageRef.current?.({
          type: WSMessageType.ALL_MESSAGES_CLEARED,
          payload: payload as { sessionId: string },
        });
      })
      .on('broadcast', { event: 'background_updated' }, ({ payload }) => {
        onMessageRef.current?.({
          type: WSMessageType.BACKGROUND_UPDATED,
          payload: payload as { backgroundType: string; backgroundUrl?: string },
        });
      })
      .on('broadcast', { event: 'theme_updated' }, ({ payload }) => {
        onMessageRef.current?.({
          type: WSMessageType.THEME_UPDATED,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          payload: payload as any,
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          retryCountRef.current = 0; // reset back-off counter on success
          clearRetryTimer();

          // Fetch initial visible messages and emit a synthetic SESSION_JOINED.
          try {
            const res = await fetch(
              `/api/messages?sessionId=${encodeURIComponent(id)}&limit=200`,
            );
            const data = (await res.json()) as { success: boolean; data: Message[] };
            const messages: Message[] = data.success ? data.data : [];
            onMessageRef.current?.({
              type: WSMessageType.SESSION_JOINED,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              payload: { session: {} as any, messages },
            });
          } catch {
            onMessageRef.current?.({
              type: WSMessageType.SESSION_JOINED,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              payload: { session: {} as any, messages: [] },
            });
          }

          setIsConnected(true);
          setIsConnecting(false);
          onOpenRef.current?.();
        } else if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          setIsConnected(false);
          setIsConnecting(false);
          onCloseRef.current?.();

          // Auto-reconnect unless the user manually disconnected.
          if (!manuallyDisconnectedRef.current) {
            scheduleRetry(id);
          }
        }
      });

    channelRef.current = channel;
  }, [clearRetryTimer, removeChannel, scheduleRetry]);

  const disconnect = useCallback(() => {
    manuallyDisconnectedRef.current = true;
    clearRetryTimer();
    removeChannel();
    setIsConnected(false);
    setIsConnecting(false);
  }, [clearRetryTimer, removeChannel]);

  const reconnect = useCallback(() => {
    manuallyDisconnectedRef.current = false;
    retryCountRef.current = 0;
    clearRetryTimer();
    removeChannel();
    if (sessionIdRef.current) subscribe(sessionIdRef.current);
  }, [clearRetryTimer, removeChannel, subscribe]);

  // No-op sendMessage — kept so existing callers compile without changes.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const sendMessage = useCallback((_msg: WSMessage) => {}, []);

  // Subscribe / resubscribe whenever sessionId changes.
  useEffect(() => {
    sessionIdRef.current = sessionId;
    if (!sessionId) return;

    manuallyDisconnectedRef.current = false;
    retryCountRef.current = 0;
    subscribe(sessionId);

    return () => {
      clearRetryTimer();
      removeChannel();
    };
    // `subscribe`, `clearRetryTimer`, `removeChannel` are stable (useCallback with no deps that change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Page-visibility reconnect: when the user switches back to the tab,
  // reconnect if the channel dropped while the tab was hidden.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        !manuallyDisconnectedRef.current &&
        sessionIdRef.current &&
        !channelRef.current
      ) {
        retryCountRef.current = 0;
        subscribe(sessionIdRef.current);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isConnected, isConnecting, sendMessage, disconnect, reconnect };
}
