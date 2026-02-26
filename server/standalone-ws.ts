#!/usr/bin/env bun
/**
 * Standalone WebSocket + HTTP management API server.
 *
 * Runs on a single port (default 3001) and serves:
 *   ws[s]://<host>:<port>/ws   — WebSocket endpoint for clients
 *   http://<host>:<port>/      — Internal HTTP management API for Next.js
 *
 * Next.js (or Vercel) communicates with this process over HTTP to broadcast
 * events and query stats.  Clients (browsers) connect directly via WebSocket.
 *
 * Environment variables:
 *   WS_PORT          (default 3001) — port to listen on
 *   WS_API_KEY       (optional)     — Bearer token required for management API calls
 *   NEXTAUTH_URL     (optional)     — used to set CORS allow-origin header
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer } from 'ws';
import { WebSocketManager } from './websocket';

// Render injects PORT; WS_PORT is used locally / in Docker.
const WS_PORT = parseInt(process.env.PORT || process.env.WS_PORT || '3001', 10);
const API_KEY = process.env.WS_API_KEY || '';
const ALLOWED_ORIGIN = process.env.NEXTAUTH_URL || '*';

// ── HTTP management API ─────────────────────────────────────────────────────

function setCors(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function checkAuth(req: IncomingMessage, res: ServerResponse): boolean {
  if (!API_KEY) return true; // no key configured → open
  const auth = req.headers['authorization'];
  if (auth === `Bearer ${API_KEY}`) return true;
  json(res, 401, { error: 'Unauthorized' });
  return false;
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c: Buffer) => { raw += c.toString(); });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

// ── Boot ────────────────────────────────────────────────────────────────────

const wss = new WebSocketServer({ noServer: true });
const wsManager = new WebSocketManager(wss);

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url || '/', `http://localhost`);
  setCors(res);

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (!checkAuth(req, res)) return;

  // ── GET /health ──────────────────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, { ok: true, port: WS_PORT });
  }

  // ── GET /stats ───────────────────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/stats') {
    return json(res, 200, wsManager.getStats());
  }

  // ── POST /action ─────────────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/action') {
    try {
      const body = await readBody(req) as Record<string, string>;
      switch (body.action) {
        case 'pause':           wsManager.pause(); break;
        case 'resume':          wsManager.resume(); break;
        case 'disconnect_all':  wsManager.disconnectAll(); break;
        case 'set_log_level':   if (body.logLevel) wsManager.setLogLevel(body.logLevel); break;
        default: return json(res, 400, { error: `Unknown action: ${body.action}` });
      }
      return json(res, 200, { ok: true, stats: wsManager.getStats() });
    } catch { return json(res, 400, { error: 'Invalid JSON' }); }
  }

  // ── POST /broadcast/* ────────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname.startsWith('/broadcast/')) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b = await readBody(req) as any;
      switch (url.pathname) {
        case '/broadcast/message-update':
          wsManager.broadcastMessageUpdate(b.sessionId, b.messageId, b.updates ?? b); break;
        case '/broadcast/message-delete':
          wsManager.broadcastMessageDelete(b.sessionId, b.messageId); break;
        case '/broadcast/all-cleared':
          wsManager.broadcastAllMessagesCleared(b.sessionId); break;
        case '/broadcast/background':
          wsManager.broadcastBackgroundUpdate(b.sessionId, b.backgroundType, b.backgroundUrl); break;
        case '/broadcast/theme':
          wsManager.broadcastThemeUpdate(b.sessionId, b.themeConfig); break;
        default: return json(res, 404, { error: 'Unknown broadcast route' });
      }
      return json(res, 200, { ok: true });
    } catch { return json(res, 400, { error: 'Invalid JSON' }); }
  }

  json(res, 404, { error: 'Not found' });
});

// Route HTTP upgrade requests to the WS server
httpServer.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url || '/', `http://localhost`);
  if (pathname === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

httpServer.listen(WS_PORT, '0.0.0.0', () => {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   Pluto — Standalone WebSocket Server        ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`\n🔌 WebSocket  →  ws://0.0.0.0:${WS_PORT}/ws`);
  console.log(`🔧 HTTP API   →  http://0.0.0.0:${WS_PORT}`);
  if (API_KEY) console.log('🔒 Management API is protected by WS_API_KEY');
  else         console.log('⚠️  WS_API_KEY not set — management API is open');
  console.log('\nSet in your Next.js environment:');
  console.log(`  WS_INTERNAL_URL=http://localhost:${WS_PORT}`);
  console.log(`  NEXT_PUBLIC_WS_URL=ws://localhost:${WS_PORT}/ws\n`);
});

// ── Graceful shutdown ───────────────────────────────────────────────────────
const shutdown = (sig: string) => {
  console.log(`\n⚠️  ${sig} received — shutting down WS server`);
  wsManager.stop();
  httpServer.close(() => process.exit(0));
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
