'use client';

import { use, useEffect, useState } from 'react';
import { useSessionByCode } from '@/lib/hooks/use-sessions';
import { PageLoading } from '@/components/loading';
import { VideoBackground } from '@/components/video-background';
import { MessageBubble } from '@/components/message-bubble';
import { SessionCodeDisplay } from '@/components/session-code-display';
import { useWebSocket } from '@/lib/hooks/use-websocket';
import { getWsUrl } from '@/lib/utils';
import { WSMessageType, Message, ThemeConfig } from '@/types';
import { AnimatePresence } from 'framer-motion';
import Image from 'next/image';

export default function PresenterPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const [messages, setMessages] = useState<Message[]>([]);
  const [themeConfig, setThemeConfig] = useState<ThemeConfig | null>(null);
  const [backgroundType, setBackgroundType] = useState<string>('color');
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  
  // Fetch session data
  const { data: sessionData, isLoading, error } = useSessionByCode(code);

  // WebSocket connection — derive URL from current hostname so it works from
  // any host (localhost, dev containers, remote servers).
  const [wsUrl] = useState(() => getWsUrl());
  const { sendMessage, isConnected } = useWebSocket({
    url: wsUrl,
    onMessage: (wsMessage) => {
      switch (wsMessage.type) {
        case WSMessageType.SESSION_JOINED:
          setMessages(wsMessage.payload.messages || []);
          break;

        case WSMessageType.NEW_MESSAGE:
          setMessages((prev) => [...prev, wsMessage.payload]);
          break;

        case WSMessageType.MESSAGE_UPDATED:
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === wsMessage.payload.messageId
                ? { ...msg, ...wsMessage.payload }
                : msg
            )
          );
          break;

        case WSMessageType.MESSAGE_DELETED:
          setMessages((prev) =>
            prev.filter((msg) => msg.id !== wsMessage.payload.messageId)
          );
          break;

        case WSMessageType.BACKGROUND_UPDATED:
          setBackgroundType(wsMessage.payload.backgroundType);
          setBackgroundUrl(wsMessage.payload.backgroundUrl);
          break;

        case WSMessageType.THEME_UPDATED:
          setThemeConfig(wsMessage.payload.themeConfig);
          break;
      }
    },
  });

  // Join session via WebSocket
  useEffect(() => {
    if (isConnected && sessionData) {
      console.log('📡 Presenter joining session as admin:', code);
      sendMessage({
        type: WSMessageType.JOIN_SESSION,
        payload: {
          sessionCode: code,
          isAdmin: true,
        },
      });

      setThemeConfig(sessionData.themeConfig as ThemeConfig);
      setBackgroundType(sessionData.backgroundType);
      setBackgroundUrl(sessionData.backgroundUrl);
    }
  }, [isConnected, sessionData, code, sendMessage]);

  // Apply theme to CSS variables (--primary overrides Tailwind so all
  // text-primary / bg-primary / border-primary utilities match the theme).
  useEffect(() => {
    if (themeConfig) {
      const root = document.documentElement;
      root.style.setProperty('--theme-primary', themeConfig.primary);
      root.style.setProperty('--theme-secondary', themeConfig.secondary);
      root.style.setProperty('--theme-background', themeConfig.background);
      root.style.setProperty('--theme-text', themeConfig.text);
      root.style.setProperty('--theme-chat-overlay', themeConfig.chatOverlay);
      root.style.setProperty('--theme-font-family', themeConfig.fontFamily);
      root.style.setProperty('--theme-font-size', `${themeConfig.fontSize}px`);
      // Let Tailwind colour utilities reflect the presenter theme.
      root.style.setProperty('--primary', themeConfig.primary);
    }
  }, [themeConfig]);

  if (isLoading) {
    return <PageLoading />;
  }

  if (error || !sessionData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Session Not Found</h1>
          <p className="text-muted-foreground">
            The session code &quot;{code}&quot; does not exist or is no longer active.
          </p>
        </div>
      </div>
    );
  }

  const visibleMessages = messages.filter((msg) => msg.isVisible);
  const pinnedMessages = visibleMessages.filter((msg) => msg.isPinned);
  const regularMessages = visibleMessages.filter((msg) => !msg.isPinned);

  const chatPosition = themeConfig?.chatPosition || 'right';
  const chatPositionClasses = {
    right: 'right-0 top-0 bottom-0 w-96',
    left: 'left-0 top-0 bottom-0 w-96',
    bottom: 'bottom-0 left-0 right-0 h-80',
  };

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ 
      background: themeConfig?.background || '#1e293b',
      color: themeConfig?.text || '#f1f5f9',
      fontFamily: themeConfig?.fontFamily || 'Inter',
      fontSize: themeConfig?.fontSize ? `${themeConfig.fontSize}px` : '16px',
    }}>
      {/* Background Layer */}
      <div className="absolute inset-0 z-0">
        {backgroundType === 'video' && backgroundUrl && (
          <VideoBackground src={backgroundUrl} />
        )}
        {backgroundType === 'image' && backgroundUrl && (
          <Image 
            src={backgroundUrl} 
            alt="Background" 
            fill
            className="object-cover"
            priority
          />
        )}
      </div>

      {/* Session Info - Top Left */}
      <div className="absolute top-4 left-4 z-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-lg p-4 max-w-sm">
          <h1 className="text-2xl font-bold mb-2">{sessionData.title}</h1>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm">{isConnected ? 'Live' : 'Disconnected'}</span>
          </div>
        </div>
      </div>

      {/* Session Code - Top Right (if not overlapping with chat) */}
      {chatPosition !== 'right' && (
        <div className="absolute top-4 right-4 z-10">
          <div className="bg-black/50 backdrop-blur-sm rounded-lg p-4">
            <div className="text-center">
              <p className="text-sm text-gray-300 mb-1">Join at</p>
              <code className="text-2xl font-bold">{code}</code>
            </div>
          </div>
        </div>
      )}

      {/* Chat Overlay */}
      <div 
        className={`absolute ${chatPositionClasses[chatPosition]} z-20 flex flex-col`}
        style={{ 
          background: themeConfig?.chatOverlay || 'rgba(15,23,42,0.9)',
          fontFamily: themeConfig?.fontFamily || 'Inter, sans-serif',
        }}
      >
        <div className="p-4 border-b border-white/10">
          <h2 className="text-xl font-bold">Chat</h2>
          <p className="text-sm text-gray-300">
            {visibleMessages.length} message{visibleMessages.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Pinned Messages */}
          {pinnedMessages.length > 0 && (
            <div className="space-y-2 pb-4 border-b border-white/10">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Pinned
              </h3>
              <AnimatePresence mode="popLayout">
                {pinnedMessages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Regular Messages */}
          <AnimatePresence mode="popLayout">
            {regularMessages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </AnimatePresence>

          {messages.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              <p>No messages yet</p>
              <p className="text-sm mt-2">Share the code {code} to let participants join</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
