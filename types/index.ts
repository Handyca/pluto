import { Session, Message, Participant, Admin, MediaAsset, MessageType, MediaType } from '@prisma/client';

// Re-export Prisma types and enums
export type { Session, Message, Participant, Admin, MediaAsset };
export { MessageType, MediaType };

// Theme configuration
export interface ThemeConfig {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  chatOverlay: string;
  fontFamily: string;
  fontSize: string;
  chatPosition: 'left' | 'right' | 'bottom';
  chatMode?: 'chat' | 'wordCloud';
  showTitle?: boolean;
  bgObjectFit?: 'cover' | 'contain' | 'fill';
  bgObjectPosition?: string;
}

// WebSocket message types
export enum WSMessageType {
  // Client to server
  JOIN_SESSION = 'join_session',
  SEND_MESSAGE = 'send_message',
  PING = 'ping',
  
  // Server to client
  SESSION_JOINED = 'session_joined',
  NEW_MESSAGE = 'new_message',
  MESSAGE_UPDATED = 'message_updated',
  MESSAGE_DELETED = 'message_deleted',
  BACKGROUND_UPDATED = 'background_updated',
  THEME_UPDATED = 'theme_updated',
  PARTICIPANT_JOINED = 'participant_joined',
  PARTICIPANT_LEFT = 'participant_left',
  ERROR = 'error',
  PONG = 'pong',
}

// WebSocket message payloads
export interface WSMessage {
  type: WSMessageType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  timestamp?: number;
}

export interface JoinSessionPayload {
  sessionCode: string;
  participantName?: string;
  isAdmin?: boolean;
  token?: string;
}

export interface SendMessagePayload {
  sessionId: string;
  participantName: string;
  type: MessageType;
  content: string;
  imageUrl?: string;
  stickerUrl?: string;
}

export interface MessageUpdatedPayload {
  messageId: string;
  isVisible?: boolean;
  isPinned?: boolean;
}

export interface BackgroundUpdatedPayload {
  sessionId: string;
  backgroundType: string;
  backgroundUrl?: string;
}

export interface ThemeUpdatedPayload {
  sessionId: string;
  themeConfig: ThemeConfig;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Session with relations (intersection rather than interface-extends so TypeScript
// correctly resolves all scalars from the Prisma-generated Session type alias)
export type SessionWithRelations = Session & {
  admin: Admin;
  messages?: Message[];
  participants?: Participant[];
  _count?: {
    messages: number;
    participants: number;
  };
};

// Message with relations
export type MessageWithRelations = Message & {
  participant?: Participant | null;
  session?: Session;
};

// Upload response
export interface UploadResponse {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

// Participant session info
export interface ParticipantSession {
  sessionId: string;
  sessionCode: string;
  participantId: string;
  participantName: string;
  anonymousId: string;
}
