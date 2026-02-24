import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { WSMessage, WSMessageType } from '@/types';
import { prisma } from '@/lib/prisma';
import { verifyParticipantToken } from '@/lib/participant-auth';

const WS_PORT = parseInt(process.env.WS_PORT || '3001', 10);

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

class WebSocketManager {
  private wss: WebSocketServer;
  private rooms: Map<string, SessionRoom> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(port: number) {
    this.wss = new WebSocketServer({ port });
    this.initialize();
  }

  private initialize() {
    console.log(`🚀 WebSocket server started on port ${WS_PORT}`);

    this.wss.on('connection', (ws: ExtendedWebSocket, request: IncomingMessage) => {
      console.log('📡 New WebSocket connection');
      
      ws.isAlive = true;

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', async (data: Buffer) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
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

  private async handleJoinSession(ws: ExtendedWebSocket, payload: any) {
    try {
      const { sessionCode, token, isAdmin } = payload;

      // Verify session exists
      const session = await prisma.session.findUnique({
        where: { code: sessionCode },
        include: { messages: { orderBy: { createdAt: 'asc' }, take: 50 } },
      });

      if (!session) {
        this.sendError(ws, 'Session not found');
        return;
      }

      // Verify token if participant
      if (!isAdmin && token) {
        const participantData = await verifyParticipantToken(token);
        if (!participantData) {
          this.sendError(ws, 'Invalid token');
          return;
        }
        ws.participantId = participantData.participantId;
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

  private async handleSendMessage(ws: ExtendedWebSocket, payload: any) {
    try {
      if (!ws.sessionId) {
        this.sendError(ws, 'Not in a session');
        return;
      }

      const { participantName, type, content, imageUrl, stickerUrl } = payload;

      // Create message in database
      const message = await prisma.message.create({
        data: {
          sessionId: ws.sessionId,
          participantId: ws.participantId,
          participantName,
          type,
          content,
          imageUrl,
          stickerUrl,
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

  public broadcastMessageUpdate(sessionId: string, messageId: string, updates: any) {
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

  public broadcastThemeUpdate(sessionId: string, themeConfig: any) {
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

  public stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.wss.close();
  }
}

// Create and export WebSocket manager instance
export const wsManager = new WebSocketManager(WS_PORT);

// Graceful shutdown
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
