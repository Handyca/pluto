/**
 * Supabase Realtime broadcast helpers.
 *
 * API routes call these functions to push real-time events to every browser
 * client subscribed to a session channel.  All communication happens over
 * the Supabase Realtime REST broadcast endpoint — no standalone WS server needed.
 *
 * Channel naming:  session:{sessionId}
 * Realtime topic:  realtime:session:{sessionId}
 *
 * Required env vars (server-side only):
 *   NEXT_PUBLIC_SUPABASE_URL    — e.g.  https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY   — service-role JWT (never expose to the browser)
 */

// ── Internal broadcast helper ──────────────────────────────────────────────

async function broadcastToSession(
  sessionId: string,
  event: string,
  payload: unknown,
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn(
      '[realtime] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — broadcast skipped.',
    );
    return;
  }

  try {
    const res = await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({
        messages: [
          {
            // subTopic (no "realtime:" prefix) — matches what .channel('session:ID') uses.
            // The Supabase REST server wraps this in the Phoenix broadcast envelope
            // before delivering to WebSocket subscribers.
            topic: `session:${sessionId}`,
            event,
            payload,
          },
        ],
      }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[realtime] broadcast failed ${res.status}:`, body);
    }
  } catch (err) {
    console.error('[realtime] broadcast error:', err);
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

