import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { WSMessage, WSMessageType, JoinSessionPayload, SendMessagePayload, ThemeConfig } from '@/types';
import { prisma } from '@/lib/prisma';
import { verifyParticipantToken } from '@/lib/participant-auth';
import { MessageType } from '@prisma/client';
import { getToken } from 'next-auth/jwt';
import { wsMessageLimiter } from '@/lib/rate-limit';

// Logging configuration: control verbosity — mutable so it can be changed at runtime.
let LOG_LEVEL = process.env.LOG_LEVEL || 'info'; // 'debug', 'info', 'warn', 'error'
const log = {
  debug: (...args: unknown[]) => LOG_LEVEL === 'debug' && console.log('[DEBUG-WS]', ...args),
  info: (...args: unknown[]) => ['debug', 'info'].includes(LOG_LEVEL) && console.log('[INFO-WS]', ...args),
  warn: (...args: unknown[]) => console.warn('[WARN-WS]', ...args),
  error: (...args: unknown[]) => console.error('[ERROR-WS]', ...args),
};

// Performance tuning
const BACKPRESSURE_LIMIT = 64 * 1024; // 64KB - warn if client buffer exceeds this
const BACKPRESSURE_TERMINATE_AFTER = 5; // terminate client after this many consecutive violations
const MESSAGE_BATCH_INTERVAL = 50; // ms - batch updates before flushing

interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
  sessionId?: string;
  participantId?: string;
  isAdmin?: boolean;
  /** Set at connection time after verifying the NextAuth JWT from cookies. */
  verifiedAdminId?: string;
  /** Consecutive high-backpressure violations before termination. */
  backpressureViolations?: number;
}

interface SessionRoom {
  sessionId: string;
  clients: Set<ExtendedWebSocket>;
}

export class WebSocketManager {
  private wss: WebSocketServer;
  private rooms: Map<string, SessionRoom> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private messageQueue: Map<string, WSMessage[]> = new Map(); // Queue for batching
  private queueFlushInterval: NodeJS.Timeout | null = null;
  private paused = false;

  /**
   * @param portOrWss Pass a port number to start a standalone WS server,
   *                  or pass an existing WebSocketServer to attach to a shared
   *                  HTTP server (so WS and HTTP share the same port).
   */
  constructor(portOrWss: number | WebSocketServer) {
    if (typeof portOrWss === 'number') {
      this.wss = new WebSocketServer({ port: portOrWss });
    } else {
      this.wss = portOrWss;
    }
    this.initialize();
  }

  private initialize() {
    const addr = this.wss.options.port
      ? `port ${this.wss.options.port}`
      : 'attached server (same port as HTTP)';
    log.info(`🚀 WebSocket server initializing on ${addr}`);

    this.wss.on('connection', async (ws: ExtendedWebSocket, request: IncomingMessage) => {
      log.debug('📡 New WebSocket connection');

      // Pre-verify admin identity from the NextAuth session cookie that the
      // browser sends automatically on the HTTP upgrade request.
      //
      // NextAuth v5 beta changed the session cookie name:
      //   v4: next-auth.session-token (or __Secure-next-auth.session-token)
      //   v5: authjs.session-token    (or __Secure-authjs.session-token)
      // We try v5 first, then fall back to v4 so both versions work.
      try {
        const isSecure = (process.env.NEXTAUTH_URL ?? '').startsWith('https');
        const cookieNameV5 = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token';
        const cookieNameV4 = isSecure ? '__Secure-next-auth.session-token' : 'next-auth.session-token';
        const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? '';

        let token = await getToken({
          req: { headers: request.headers as Record<string, string> },
          secret,
          cookieName: cookieNameV5,
        });
        if (!token?.sub) {
          token = await getToken({
            req: { headers: request.headers as Record<string, string> },
            secret,
            cookieName: cookieNameV4,
          });
        }
        if (token?.sub) {
          ws.verifiedAdminId = token.sub;
          log.debug('Admin connection verified, id:', token.sub);
        }
      } catch {
        // Non-admin connection — that's fine, verifiedAdminId stays undefined.
      }

      ws.isAlive = true;

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', async (data: Buffer) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          // Only log in debug mode to avoid blocking I/O
          log.debug('📨 Message type:', message.type);
          await this.handleMessage(ws, message);
        } catch (error) {
          log.error('Failed to parse message:', error);
          this.sendError(ws, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        log.debug('📴 Connection closed');
        this.handleDisconnect(ws);
      });

      ws.on('error', (error) => {
        log.error('WebSocket error:', error);
      });
    });

    this.startHeartbeat();
    this.startQueueFlusher();

    log.info('✅ WebSocket server ready');
  }

  private startQueueFlusher() {
    this.queueFlushInterval = setInterval(() => {
      this.messageQueue.forEach((messages, sessionId) => {
        messages.forEach(msg => {
          this.broadcastToRoom(sessionId, msg);
        });
      });
      this.messageQueue.clear();
    }, MESSAGE_BATCH_INTERVAL);
  }

  private async handleMessage(ws: ExtendedWebSocket, message: WSMessage) {
    switch (message.type) {
      case WSMessageType.JOIN_SESSION:
        await this.handleJoinSession(ws, message.payload);
        break;

      case WSMessageType.SEND_MESSAGE:
        await this.handleSendMessage(ws, message.payload);
        break;

      case WSMessageType.PING:
        this.send(ws, { type: WSMessageType.PONG, payload: {} });
        break;

      default:
        console.warn('⚠️ Unknown message type:', message.type);
    }
  }

  private async handleJoinSession(ws: ExtendedWebSocket, payload: JoinSessionPayload) {
    try {
      const { sessionCode, token, isAdmin } = payload;

      // ── Auth check FIRST — before any DB query ──────────────────────────
      if (isAdmin) {
        if (ws.verifiedAdminId) {
          // Cookie-verified admin — sees all messages including hidden ones.
          ws.isAdmin = true;
        } else {
          // Cookie not verified (NextAuth cookie mismatch / not logged in).
          // Downgrade to observer so the presenter / admin panel still
          // receives real-time broadcasts, but only sees visible messages.
          log.debug('⚠️  isAdmin=true but no verified session — downgrading to observer');
          ws.isAdmin = false;
        }
      } else {
        // Participant join: verify participant token.
        if (token) {
          const participantData = await verifyParticipantToken(token as string);
          if (!participantData) {
            log.debug('Invalid participant token');
            this.sendError(ws, 'Invalid token');
            return;
          }
          ws.participantId = participantData.participantId;
        }
        ws.isAdmin = false;
      }

      // ── Fetch session, filtering hidden messages for non-admins ─────────
      const session = await prisma.session.findUnique({
        where: { code: sessionCode },
        select: {
          id: true,
          title: true,
          code: true,
          isActive: true,
          backgroundType: true,
          backgroundUrl: true,
          themeConfig: true,
          messages: {
            // Participants only see visible messages; admins see everything.
            where: ws.isAdmin ? undefined : { isVisible: true },
            orderBy: { createdAt: 'asc' },
            take: 30,
            select: {
              id: true,
              sessionId: true,
              participantId: true,
              participantName: true,
              type: true,
              content: true,
              imageUrl: true,
              stickerUrl: true,
              isVisible: true,
              isPinned: true,
              createdAt: true,
            },
          },
        },
      });

      if (!session) {
        log.debug(`Session not found: ${sessionCode}`);
        this.sendError(ws, 'Session not found');
        return;
      }

      // Reject joins when the server is administratively paused.
      if (this.paused) {
        this.sendError(ws, 'WebSocket server is paused — try again later');
        ws.terminate();
        return;
      }

      // Add to room
      ws.sessionId = session.id;
      this.addToRoom(session.id, ws);

      // Send session data
      this.send(ws, {
        type: WSMessageType.SESSION_JOINED,
        payload: {
          session: {
            id: session.id,
            title: session.title,
            code: session.code,
            backgroundType: session.backgroundType,
            backgroundUrl: session.backgroundUrl,
            themeConfig: session.themeConfig,
          },
          messages: session.messages,
        },
      });

      log.debug(`✅ Client joined: ${session.code}`);
    } catch (error) {
      log.error('Error joining session:', error);
      this.sendError(ws, 'Failed to join session');
    }
  }

  private async handleSendMessage(ws: ExtendedWebSocket, payload: SendMessagePayload) {
    try {
      if (!ws.sessionId) {
        this.sendError(ws, 'Not in a session');
        return;
      }

      // Rate limit: 20 messages per 10 seconds per participant or anonymous IP.
      const rateKey = ws.participantId ?? ws.sessionId ?? 'anon';
      if (wsMessageLimiter.isRateLimited(rateKey)) {
        this.sendError(ws, 'Too many messages — slow down');
        return;
      }

      // Validate payload
      const participantName = payload.participantName ?? '';
      const rawType = payload.type as string | undefined;
      const content = payload.content ?? '';
      const imageUrl = payload.imageUrl;
      const stickerUrl = payload.stickerUrl;

      if (!participantName || participantName.length > 100) {
        this.sendError(ws, 'Invalid participantName');
        return;
      }
      if (!content && !imageUrl && !stickerUrl) {
        this.sendError(ws, 'Message content is required');
        return;
      }
      if (content.length > 1000) {
        this.sendError(ws, 'Message too long (max 1000 characters)');
        return;
      }
      const validTypes: string[] = Object.values(MessageType);
      if (!rawType || !validTypes.includes(rawType)) {
        this.sendError(ws, 'Invalid message type');
        return;
      }
      const type = rawType as MessageType;

      // Verify the session is still active before inserting.
      const sessionActive = await prisma.session.findUnique({
        where: { id: ws.sessionId },
        select: { isActive: true },
      });
      if (!sessionActive?.isActive) {
        this.sendError(ws, 'Session is not active');
        return;
      }

      // Create message in database
      const message = await prisma.message.create({
        data: {
          sessionId: ws.sessionId,
          participantId: ws.participantId,
          participantName,
          type,
          content,
          imageUrl: imageUrl ?? null,
          stickerUrl: stickerUrl ?? null,
        },
      });

      // Broadcast to all clients
      this.broadcastToRoom(ws.sessionId, {
        type: WSMessageType.NEW_MESSAGE,
        payload: message,
      });
    } catch (error) {
      log.error('Error sending message:', error);
      this.sendError(ws, 'Failed to send message');
    }
  }

  public broadcastMessageUpdate(sessionId: string, messageId: string, updates: { isVisible?: boolean; isPinned?: boolean }) {
    // Queue updates instead of sending immediately (batching for efficiency)
    this.queueMessage(sessionId, {
      type: WSMessageType.MESSAGE_UPDATED,
      payload: { messageId, ...updates },
    });
  }

  public broadcastMessageDelete(sessionId: string, messageId: string) {
    this.queueMessage(sessionId, {
      type: WSMessageType.MESSAGE_DELETED,
      payload: { messageId },
    });
  }

  private queueMessage(sessionId: string, message: WSMessage) {
    if (!this.messageQueue.has(sessionId)) {
      this.messageQueue.set(sessionId, []);
    }
    this.messageQueue.get(sessionId)!.push(message);
  }

  public broadcastAllMessagesCleared(sessionId: string) {
    this.broadcastToRoom(sessionId, {
      type: WSMessageType.ALL_MESSAGES_CLEARED,
      payload: { sessionId },
    });
  }

  public broadcastBackgroundUpdate(sessionId: string, backgroundType: string, backgroundUrl?: string) {
    this.broadcastToRoom(sessionId, {
      type: WSMessageType.BACKGROUND_UPDATED,
      payload: { backgroundType, backgroundUrl },
    });
  }

  public broadcastThemeUpdate(sessionId: string, themeConfig: unknown) {
    this.broadcastToRoom(sessionId, {
      type: WSMessageType.THEME_UPDATED,
      payload: { themeConfig: themeConfig as ThemeConfig },
    });
  }

  private addToRoom(sessionId: string, ws: ExtendedWebSocket) {
    if (!this.rooms.has(sessionId)) {
      this.rooms.set(sessionId, {
        sessionId,
        clients: new Set(),
      });
    }

    const room = this.rooms.get(sessionId)!;
    room.clients.add(ws);
  }

  private removeFromRoom(sessionId: string, ws: ExtendedWebSocket) {
    const room = this.rooms.get(sessionId);
    if (room) {
      room.clients.delete(ws);
      if (room.clients.size === 0) {
        this.rooms.delete(sessionId);
      }
    }
  }

  private broadcastToRoom(sessionId: string, message: WSMessage) {
    const room = this.rooms.get(sessionId);
    if (!room) return;

    const messageStr = JSON.stringify(message);
    const deadClients: ExtendedWebSocket[] = [];

    room.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        // Monitor backpressure - terminate slow clients after repeated violations
        if (client.bufferedAmount > BACKPRESSURE_LIMIT) {
          client.backpressureViolations = (client.backpressureViolations ?? 0) + 1;
          log.warn(`⚠️ High backpressure for client (${client.bufferedAmount} bytes, violation ${client.backpressureViolations}/${BACKPRESSURE_TERMINATE_AFTER})`);
          if (client.backpressureViolations >= BACKPRESSURE_TERMINATE_AFTER) {
            log.warn('❌ Terminating slow client after repeated backpressure violations');
            client.terminate();
            deadClients.push(client);
            return;
          }
        } else {
          // Reset counter when backpressure clears
          client.backpressureViolations = 0;
        }

        // Send with error callback to detect dead connections
        client.send(messageStr, (err?: Error | null) => {
          if (err) {
            log.debug('Send error, marking client for removal');
            deadClients.push(client);
          }
        });
      } else {
        deadClients.push(client);
      }
    });

    // Clean up dead connections immediately
    deadClients.forEach(client => {
      room.clients.delete(client);
    });
  }

  private send(ws: WebSocket, message: WSMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message), (err?: Error | null) => {
        if (err) {
          log.debug('Error sending to client:', err);
        }
      });
    }
  }

  private sendError(ws: WebSocket, error: string) {
    this.send(ws, {
      type: WSMessageType.ERROR,
      payload: { error },
    });
  }

  private handleDisconnect(ws: ExtendedWebSocket) {
    if (ws.sessionId) {
      this.removeFromRoom(ws.sessionId, ws);
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws: WebSocket) => {
        const extWs = ws as ExtendedWebSocket;
        
        if (!extWs.isAlive) {
          return extWs.terminate();
        }
        
        extWs.isAlive = false;
        extWs.ping((err?: Error | null) => {
          if (err) {
            log.debug('Ping error:', err);
          }
        });
      });
    }, 30000); // 30 seconds
  }

  public getStats() {
    const rooms: { sessionId: string; clients: number; admins: number }[] = [];
    this.rooms.forEach((room) => {
      let admins = 0;
      room.clients.forEach((c) => { if (c.isAdmin) admins++; });
      rooms.push({ sessionId: room.sessionId, clients: room.clients.size, admins });
    });
    
    const queuedMessages = Array.from(this.messageQueue.values()).reduce((sum, arr) => sum + arr.length, 0);
    const serverPort = this.wss.options.port as number | undefined;
    
    return {
      totalConnections: this.wss.clients.size,
      activeRooms: this.rooms.size,
      queuedMessages,
      isPaused: this.paused,
      logLevel: LOG_LEVEL,
      serverPort: serverPort ?? null,
      rooms,
    };
  }

  /** Pause the WS server: reject new joins and kick all connected clients. */
  public pause() {
    this.paused = true;
    log.info('⏸  WS server paused — disconnecting all clients');
    this.disconnectAll('Server paused by administrator');
  }

  /** Resume the WS server: allow new joins again. */
  public resume() {
    this.paused = false;
    log.info('▶  WS server resumed');
  }

  /** Kick all currently connected clients without pausing. */
  public disconnectAll(reason = 'Disconnected by administrator') {
    this.wss.clients.forEach((ws) => {
      this.sendError(ws as ExtendedWebSocket, reason);
      ws.terminate();
    });
    this.rooms.clear();
    log.info(`🔌 Disconnected all clients. Reason: ${reason}`);
  }

  /** Change the runtime log level. */
  public setLogLevel(level: string) {
    const valid = ['debug', 'info', 'warn', 'error'];
    if (!valid.includes(level)) return;
    LOG_LEVEL = level;
    log.info(`📝 Log level changed to: ${level}`);
  }

  public stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.queueFlushInterval) {
      clearInterval(this.queueFlushInterval);
    }
    this.wss.close();
  }
}

// WebSocketManager is exported above.
// To run a standalone WS server use:  bun run server/standalone-ws.ts
// To embed WS in the combined dev server use:  bun run dev
