/**
 * Global WebSocketManager singleton accessor.
 *
 * The custom server (server/custom-server.ts) stores the WebSocketManager
 * instance on `globalThis` so that Next.js Route Handlers running in the
 * same Node.js process can broadcast WS events without a separate IPC channel.
 *
 * Usage (API routes):
 *   import { getWsManager } from '@/lib/ws-manager';
 *   getWsManager()?.broadcastMessageUpdate(sessionId, messageId, updates);
 */
import type { WebSocketManager } from '@/server/websocket';

declare global {
  var __wsManager: WebSocketManager | undefined;
}

export function getWsManager(): WebSocketManager | null {
  return globalThis.__wsManager ?? null;
}

export function setWsManager(manager: WebSocketManager): void {
  globalThis.__wsManager = manager;
}
