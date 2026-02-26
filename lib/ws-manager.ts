/**
 * WebSocket HTTP proxy client.
 *
 * Next.js API routes call these functions to send broadcasts / query the
 * standalone WS server.  All communication goes over HTTP so Next.js can
 * run as a serverless / Vercel function and the WS server can run on any
 * plain Node.js / Bun host (Railway, Fly.io, Render, self-hosted VPS…).
 *
 * URL resolution priority (highest → lowest):
 *   1. Runtime override written by admin via the WS Monitor UI
 *      → stored in  cache/ws-config.json  (self-hosted only, ignored on Vercel)
 *   2. WS_INTERNAL_URL  environment variable
 *   3. http://localhost:<WS_PORT|3001>
 *
 * Client-side WS URL (used by browsers) is resolved in lib/utils.ts and
 * relies on:
 *   NEXT_PUBLIC_WS_URL  →  e.g.  wss://ws.myapp.com/ws
 * If not set, falls back to the same-host derived URL.
 *
 * Security: set WS_API_KEY on both the WS server and Next.js to require
 * a Bearer token on every management API call.
 */

import path from 'path';
import fs from 'fs';

// ── Config file (runtime override, self-hosted only) ───────────────────────

const WS_CONFIG_PATH = path.join(process.cwd(), 'cache', 'ws-config.json');

interface WsRuntimeConfig {
  internalUrl?: string; // URL Next.js uses to reach the WS management API
}

export function readWsRuntimeConfig(): WsRuntimeConfig {
  try {
    return JSON.parse(fs.readFileSync(WS_CONFIG_PATH, 'utf-8')) as WsRuntimeConfig;
  } catch {
    return {};
  }
}

export function writeWsRuntimeConfig(cfg: WsRuntimeConfig): void {
  try {
    fs.mkdirSync(path.dirname(WS_CONFIG_PATH), { recursive: true });
    fs.writeFileSync(WS_CONFIG_PATH, JSON.stringify(cfg, null, 2));
  } catch (e) {
    console.warn('[ws-manager] Could not write ws-config.json:', e);
  }
}

// ── URL resolution ─────────────────────────────────────────────────────────

/**
 * Returns the base HTTP URL of the WS management API, e.g. http://localhost:3001
 */
export function getWsInternalUrl(): string {
  // 1. Runtime override (from monitor UI, stored in cache/ws-config.json)
  const runtimeCfg = readWsRuntimeConfig();
  if (runtimeCfg.internalUrl) return runtimeCfg.internalUrl.replace(/\/$/, '');
  // 2. Env var
  if (process.env.WS_INTERNAL_URL) return process.env.WS_INTERNAL_URL.replace(/\/$/, '');
  // 3. Derive from WS_PORT
  return `http://localhost:${process.env.WS_PORT || '3001'}`;
}

function getHeaders(): HeadersInit {
  const key = process.env.WS_API_KEY;
  return {
    'Content-Type': 'application/json',
    ...(key ? { Authorization: `Bearer ${key}` } : {}),
  };
}

// ── Stats / actions ────────────────────────────────────────────────────────

export interface WsRoomStats {
  sessionId: string;
  clients: number;
  admins: number;
}

export interface WsStats {
  totalConnections: number;
  activeRooms: number;
  queuedMessages: number;
  isPaused: boolean;
  logLevel: string;
  serverPort: number | null;
  rooms: WsRoomStats[];
}

export type WsStatsResult =
  | (WsStats & { available: true; serverUrl: string; internalUrl: string })
  | { available: false; internalUrl: string };

export async function getWsStats(): Promise<WsStatsResult> {
  const internalUrl = getWsInternalUrl();
  try {
    const res = await fetch(`${internalUrl}/stats`, {
      headers: getHeaders(),
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { available: false, internalUrl };
    const stats = (await res.json()) as WsStats;
    // Derive the public WS URL from the internal URL for display
    const serverUrl = internalUrl.replace(/^http/, 'ws') + '/ws';
    return { ...stats, available: true, serverUrl, internalUrl };
  } catch {
    return { available: false, internalUrl };
  }
}

export async function sendWsAction(
  action: string,
  extra?: Record<string, unknown>,
): Promise<WsStats | null> {
  try {
    const res = await fetch(`${getWsInternalUrl()}/action`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ action, ...extra }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const { stats } = (await res.json()) as { ok: boolean; stats: WsStats };
    return stats ?? null;
  } catch {
    return null;
  }
}

// ── Broadcast helpers (fire-and-forget) ────────────────────────────────────

async function post(path: string, body: unknown): Promise<void> {
  try {
    await fetch(`${getWsInternalUrl()}${path}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // WS server offline — fail silently so the main app keeps running.
  }
}

export function broadcastMessageUpdate(
  sessionId: string,
  messageId: string,
  updates: { isVisible?: boolean; isPinned?: boolean },
): void {
  void post('/broadcast/message-update', { sessionId, messageId, updates });
}

export function broadcastMessageDelete(sessionId: string, messageId: string): void {
  void post('/broadcast/message-delete', { sessionId, messageId });
}

export function broadcastAllMessagesCleared(sessionId: string): void {
  void post('/broadcast/all-cleared', { sessionId });
}

export function broadcastBackgroundUpdate(
  sessionId: string,
  backgroundType: string,
  backgroundUrl?: string,
): void {
  void post('/broadcast/background', { sessionId, backgroundType, backgroundUrl });
}

export function broadcastThemeUpdate(sessionId: string, themeConfig: unknown): void {
  void post('/broadcast/theme', { sessionId, themeConfig });
}

// ── Legacy shim — keeps existing callers working unchanged ─────────────────
// API routes that use getWsManager()?.broadcastX() continue to work without
// any modification.  The methods are now fire-and-forget (void return).

export function getWsManager() {
  return {
    broadcastMessageUpdate,
    broadcastMessageDelete,
    broadcastAllMessagesCleared,
    broadcastBackgroundUpdate,
    broadcastThemeUpdate,
  };
}

/** @deprecated No-op in the new architecture — WS runs in a separate process. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function setWsManager(_: unknown): void {
  // intentionally empty
}

