/**
 * Supabase Realtime broadcast helpers.
 *
 * API routes call these functions to push real-time events to every browser
 * client subscribed to a session channel.
 *
 * Uses the Supabase JS client's channel().send() which handles the correct
 * internal topic naming automatically — the same channel name used by the
 * browser client is used here, so the match is guaranteed.
 *
 * Channel naming: session:{sessionId}  (used on both server and client)
 *
 * Required env vars (server-side only):
 *   NEXT_PUBLIC_SUPABASE_URL    — e.g.  https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY   — service-role JWT (never expose to the browser)
 */

import { getSupabaseServerClient } from '@/lib/supabase';

// ── Internal broadcast helper ──────────────────────────────────────────────

async function broadcastToSession(
  sessionId: string,
  event: string,
  payload: unknown,
): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      '[realtime] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — broadcast skipped.',
    );
    return;
  }

  const supabase = getSupabaseServerClient();
  // Use the same channel name the browser client subscribes to.
  // The Supabase JS client handles topic formatting internally.
  const channel = supabase.channel(`session:${sessionId}`);

  try {
    const result = await channel.send({
      type: 'broadcast',
      event,
      payload: payload as Record<string, unknown>,
    });
    if (result !== 'ok') {
      console.error(`[realtime] broadcast failed for event "${event}":`, result);
    }
  } catch (err) {
    console.error('[realtime] broadcast error:', err);
  } finally {
    await supabase.removeChannel(channel);
  }
}

// ── Public broadcast functions ─────────────────────────────────────────────

export function broadcastNewMessage(sessionId: string, message: unknown): void {
  void broadcastToSession(sessionId, 'new_message', message);
}

export function broadcastMessageUpdate(
  sessionId: string,
  messageId: string,
  updates: { isVisible?: boolean; isPinned?: boolean },
): void {
  void broadcastToSession(sessionId, 'message_updated', { messageId, ...updates });
}

export function broadcastMessageDelete(sessionId: string, messageId: string): void {
  void broadcastToSession(sessionId, 'message_deleted', { messageId });
}

export function broadcastAllMessagesCleared(sessionId: string): void {
  void broadcastToSession(sessionId, 'all_messages_cleared', { sessionId });
}

export function broadcastBackgroundUpdate(
  sessionId: string,
  backgroundType: string,
  backgroundUrl?: string,
): void {
  void broadcastToSession(sessionId, 'background_updated', { backgroundType, backgroundUrl });
}

export function broadcastThemeUpdate(sessionId: string, themeConfig: unknown): void {
  void broadcastToSession(sessionId, 'theme_updated', { themeConfig });
}

// ── Legacy shim — keeps existing callers using getWsManager()?.broadcastX() ─

export function getWsManager() {
  return {
    broadcastNewMessage,
    broadcastMessageUpdate,
    broadcastMessageDelete,
    broadcastAllMessagesCleared,
    broadcastBackgroundUpdate,
    broadcastThemeUpdate,
  };
}

/** @deprecated No-op in the Supabase Realtime architecture. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function setWsManager(_: unknown): void {
  // intentionally empty
}

// ── Admin / monitor helpers ────────────────────────────────────────────────

export interface RealtimeStatus {
  available: boolean;
  projectUrl: string;
}

export async function getRealtimeStatus(): Promise<RealtimeStatus> {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return { available: !!projectUrl, projectUrl };
}

