'use client';

import { use, useEffect, useRef, useState } from 'react';
import { useSessionByCode } from '@/lib/hooks/use-sessions';
import { PageLoading } from '@/components/loading';
import { VideoBackground } from '@/components/video-background';
import { MessageBubble } from '@/components/message-bubble';
import { useWebSocket } from '@/lib/hooks/use-websocket';
import { getWsUrl } from '@/lib/utils';
import { WSMessageType, Message, ThemeConfig } from '@/types';
import { AnimatePresence } from 'framer-motion';

import QRCodeLib from 'qrcode';

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
  const [joinUrl, setJoinUrl] = useState('');
  const [qrCode, setQrCode] = useState('');
  const didInitSessionRef = useRef(false);
  
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
    if (!isConnected || !sessionData) return;
    if (didInitSessionRef.current) return;

    didInitSessionRef.current = true;
    console.log('📡 Presenter joining session as admin:', code);
    sendMessage({
      type: WSMessageType.JOIN_SESSION,
      payload: {
        sessionCode: code,
        isAdmin: true,
      },
    });

    /* eslint-disable react-hooks/set-state-in-effect */
    setThemeConfig(sessionData.themeConfig as unknown as ThemeConfig);
    setBackgroundType(sessionData.backgroundType);
    setBackgroundUrl(sessionData.backgroundUrl);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isConnected, sessionData, code, sendMessage]);

  useEffect(() => {
    didInitSessionRef.current = false;
  }, [code]);

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/join/${code}`;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJoinUrl(url);
    QRCodeLib.toDataURL(url, {
      width: 180,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    }).then(setQrCode);
  }, [code]);

  // Derived state — must be computed before any early returns to satisfy Rules of Hooks.
  const visibleMessages = messages.filter((msg) => msg.isVisible);
  const pinnedMessages = visibleMessages.filter((msg) => msg.isPinned);
  const regularMessages = visibleMessages.filter((msg) => !msg.isPinned);

  const chatPosition = themeConfig?.chatPosition || 'right';
  const showTitle = themeConfig?.showTitle !== false;
  const chatPositionClasses = {
    right: 'right-0 top-0 bottom-0 w-96',
    left: 'left-0 top-0 bottom-0 w-96',
    bottom: 'bottom-0 left-0 right-0 h-80',
  };

  // Early returns after all hooks are called.
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
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${backgroundUrl})`,
              backgroundSize: themeConfig?.bgObjectFit === 'contain' ? 'contain' : themeConfig?.bgObjectFit === 'fill' ? '100% 100%' : 'cover',
              backgroundPosition: themeConfig?.bgObjectPosition || 'center center',
              backgroundRepeat: 'no-repeat',
            }}
          />
        )}
      </div>

      {/* Session Info - Top Left */}
      {showTitle && (
        <div className="absolute top-4 left-4 z-10">
          <div className="bg-black/50 backdrop-blur-sm rounded-lg p-4 max-w-sm">
            <h1 className="text-2xl font-bold mb-2">{sessionData.title}</h1>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm">{isConnected ? 'Live' : 'Disconnected'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Session Code has been merged into the QR panel at bottom-left */}

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

      {/* Join QR Code + Session Code - Bottom Left */}
      {qrCode && (
        <div className="absolute bottom-4 left-4 z-10">
          <div className="bg-black/60 backdrop-blur-sm rounded-xl p-4 flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCode} alt="Join QR" className="w-32 h-32 rounded" />
            <div className="text-center">
              <p className="text-xs text-gray-300">or join with code</p>
              <code className="text-2xl font-bold tracking-widest text-white">{code}</code>
            </div>
            <p className="text-xs text-gray-400 truncate max-w-[9rem]">
              {joinUrl.replace(/^https?:\/\//, '')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
