import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { WSMessage, WSMessageType } from '@/types';
import { prisma } from '@/lib/prisma';
import { verifyParticipantToken } from '@/lib/participant-auth';
import { MessageType } from '@prisma/client';


interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
  sessionId?: string;
  participantId?: string;
  isAdmin?: boolean;
}

interface SessionRoom {
  sessionId: string;
  clients: Set<ExtendedWebSocket>;
}

export class WebSocketManager {
  private wss: WebSocketServer;
  private rooms: Map<string, SessionRoom> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

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
    console.log(`🚀 WebSocket handler initializing on ${addr}`);

    this.wss.on('connection', (ws: ExtendedWebSocket, request: IncomingMessage) => {
      console.log('📡 New WebSocket connection received');
      const clientIp = request.socket.remoteAddress;
      console.log(`   Client: ${clientIp}`);
      
      ws.isAlive = true;

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', async (data: Buffer) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          console.log(`📨 WebSocket message received:`, message.type);
          await this.handleMessage(ws, message);
        } catch (error) {
          console.error('❌ Error handling WebSocket message:', error);
          this.sendError(ws, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        console.log('📴 WebSocket connection closed');
        this.handleDisconnect(ws);
      });

      ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
      });
    });

    // Start heartbeat
    this.startHeartbeat();

    console.log('✅ WebSocket server is ready');
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

  private async handleJoinSession(ws: ExtendedWebSocket, payload: Record<string, unknown>) {
    try {
      const sessionCode = payload.sessionCode as string | undefined;
      const token = payload.token as string | undefined;
      const isAdmin = payload.isAdmin as boolean | undefined;
      console.log(`🔐 JOIN_SESSION: sessionCode=${sessionCode}, isAdmin=${isAdmin}, hasToken=${!!token}`);

      // Verify session exists
      const session = await prisma.session.findUnique({
        where: { code: sessionCode },
        include: { messages: { orderBy: { createdAt: 'asc' }, take: 50 } },
      });

      if (!session) {
        console.error(`❌ Session not found: ${sessionCode}`);
        this.sendError(ws, 'Session not found');
        return;
      }
      console.log(`✅ Session found: ${session.title} (ID: ${session.id})`);

      // Verify token if participant
      if (!isAdmin && token) {
        const participantData = await verifyParticipantToken(token as string);
        if (!participantData) {
          console.error(`❌ Invalid participant token`);
          this.sendError(ws, 'Invalid token');
          return;
        }
        ws.participantId = participantData.participantId;
        console.log(`✅ Participant verified: ${participantData.participantName}`);
      }

      // Add to room
      ws.sessionId = session.id;
      ws.isAdmin = isAdmin || false;
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

      console.log(`✅ Client joined session: ${session.code}`);
    } catch (error) {
      console.error('❌ Error joining session:', error);
      this.sendError(ws, 'Failed to join session');
    }
  }

  private async handleSendMessage(ws: ExtendedWebSocket, payload: Record<string, unknown>) {
    try {
      if (!ws.sessionId) {
        this.sendError(ws, 'Not in a session');
        return;
      }

      const participantName = payload.participantName as string;
      const type = payload.type as MessageType;
      const content = payload.content as string;
      const imageUrl = payload.imageUrl as string | undefined;
      const stickerUrl = payload.stickerUrl as string | undefined;

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

      // Broadcast to all clients in the room
      this.broadcastToRoom(ws.sessionId, {
        type: WSMessageType.NEW_MESSAGE,
        payload: message,
      });

      console.log(`📨 New message in session ${ws.sessionId}`);
    } catch (error) {
      console.error('❌ Error sending message:', error);
      this.sendError(ws, 'Failed to send message');
    }
  }

  public broadcastMessageUpdate(sessionId: string, messageId: string, updates: { isVisible?: boolean; isPinned?: boolean }) {
    this.broadcastToRoom(sessionId, {
      type: WSMessageType.MESSAGE_UPDATED,
      payload: { messageId, ...updates },
    });
  }

  public broadcastMessageDelete(sessionId: string, messageId: string) {
    this.broadcastToRoom(sessionId, {
      type: WSMessageType.MESSAGE_DELETED,
      payload: { messageId },
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
      payload: { themeConfig },
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
    room.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  private send(ws: WebSocket, message: WSMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
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
        extWs.ping();
      });
    }, 30000); // 30 seconds
  }

  public getStats() {
    const rooms: { sessionId: string; clients: number; admins: number }[] = [];
    this.rooms.forEach((room, sessionId) => {
      let admins = 0;
      room.clients.forEach((c) => { if (c.isAdmin) admins++; });
      rooms.push({ sessionId, clients: room.clients.size, admins });
    });
    return {
      totalConnections: this.wss.clients.size,
      activeRooms: this.rooms.size,
      rooms,
    };
  }

  public stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.wss.close();
  }
}

// WebSocketManager is exported above.
// To run a standalone WS server use:  bun run server/standalone-ws.ts
// To embed WS in the combined dev server use:  bun run dev
