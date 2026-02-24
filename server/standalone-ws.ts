#!/usr/bin/env bun
/**
 * Standalone WebSocket server entry point (debugging / legacy use).
 *
 * For normal development use `bun run dev` which runs Next.js and WebSocket
 * on the same port via server/custom-server.ts.
 *
 * Use this only if you specifically need the WS server on its own port:
 *   bun run dev:ws
 */

import { WebSocketManager } from './websocket';

const WS_PORT = parseInt(process.env.WS_PORT || '3001', 10);
const wsManager = new WebSocketManager(WS_PORT);

process.on('SIGTERM', () => {
  console.log('⚠️ SIGTERM received, shutting down WebSocket server');
  wsManager.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('⚠️ SIGINT received, shutting down WebSocket server');
  wsManager.stop();
  process.exit(0);
});
