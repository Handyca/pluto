#!/usr/bin/env bun
/**
 * Combined HTTP + WebSocket server.
 *
 * Runs Next.js (HTTP) and the WebSocket server on the SAME port so that
 * browsers accessing the app through any kind of proxy/tunnel (VS Code
 * dev-container port forwarding, Cloudflare, Nginx, etc.) never need a
 * second port open.
 *
 * WebSocket clients connect to:  ws[s]://<host>/ws
 * Next.js serves all other requests on the same host:port.
 */

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer } from 'ws';
import { WebSocketManager } from './websocket';
import { setWsManager } from '@/lib/ws-manager';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function start() {
  await app.prepare();

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // WebSocket server — attached to the HTTP server, no separate port.
  const wss = new WebSocketServer({ noServer: true });
  const wsManager = new WebSocketManager(wss);
  // Expose singleton so Next.js Route Handlers can broadcast events.
  setWsManager(wsManager);

  // Route HTTP Upgrade requests at /ws to our WebSocket server.
  // All other upgrade paths (e.g. Next.js HMR /_next/webpack-hmr) are left
  // untouched so Next.js can attach its own listeners later.
  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url || '');
    if (pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
    // Do NOT destroy the socket for other paths — Next.js handles its own upgrades.
  });

  server.listen(port, hostname, () => {
    console.log(`🚀 Pluto server  →  http://localhost:${port}`);
    console.log(`🔌 WebSocket     →  ws://localhost:${port}/ws`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n🛑 Shutting down…');
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
