"use client";

import { use, useEffect, useRef, useState } from "react";
import { useSessionByCode } from "@/lib/hooks/use-sessions";
import { PageLoading } from "@/components/loading";
import { MessageBubble } from "@/components/message-bubble";
import { useWebSocket } from "@/lib/hooks/use-websocket";
import { getWsUrl } from "@/lib/utils";
import { WSMessageType, Message, ThemeConfig } from "@/types";
import { parseThemeConfig } from "@/lib/schemas";
import { AnimatePresence } from "framer-motion";
import { Pin, Minimize2 } from "lucide-react";

export default function PresenterChatPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const [messages, setMessages] = useState<Message[]>([]);
  const [themeConfig, setThemeConfig] = useState<ThemeConfig | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: sessionData, isLoading, error } = useSessionByCode(code);

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
                : msg,
            ),
          );
          break;
        case WSMessageType.MESSAGE_DELETED:
          setMessages((prev) =>
            prev.filter((msg) => msg.id !== wsMessage.payload.messageId),
          );
          break;
        case WSMessageType.THEME_UPDATED:
          setThemeConfig(wsMessage.payload.themeConfig as ThemeConfig);
          break;
      }
    },
  });

  useEffect(() => {
    if (!isConnected || !sessionData) return;
    sendMessage({
      type: WSMessageType.JOIN_SESSION,
      payload: { sessionCode: code },
    });
    setThemeConfig(parseThemeConfig(sessionData.themeConfig));
  }, [isConnected, sessionData, code, sendMessage]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (isLoading) return <PageLoading />;
  if (error || !sessionData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Session not found.</p>
      </div>
    );
  }

  const visibleMessages = messages.filter((m) => m.isVisible);
  const pinnedMessages = visibleMessages.filter((m) => m.isPinned);
  const regularMessages = visibleMessages.filter((m) => !m.isPinned);

  const bg = themeConfig?.chatOverlay || "rgba(15,23,42,0.97)";
  const textColor = themeConfig?.text || "#f1f5f9";
  const fontFamily = themeConfig?.fontFamily || "Inter, sans-serif";

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ background: bg, color: textColor, fontFamily }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold">Chat</h1>
          <p className="text-xs opacity-60">{sessionData.title}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs opacity-70">
            <span
              className={`h-2 w-2 rounded-full ${
                isConnected ? "bg-green-400 animate-pulse" : "bg-red-400"
              }`}
            />
            {isConnected ? "Live" : "Disconnected"}
          </div>
          <button
            onClick={() => window.close()}
            title="Close"
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Pinned */}
        {pinnedMessages.length > 0 && (
          <div className="space-y-2 pb-3 border-b border-white/10">
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider opacity-50">
              <Pin className="h-3 w-3" />
              Pinned
            </div>
            <AnimatePresence mode="popLayout">
              {pinnedMessages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Regular */}
        <AnimatePresence mode="popLayout">
          {regularMessages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </AnimatePresence>

        {visibleMessages.length === 0 && (
          <div className="flex items-center justify-center h-40 text-sm opacity-40">
            No messages yet
          </div>
        )}

        {/* Auto-scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      <div className="px-5 py-2 border-t border-white/10 flex-shrink-0 text-xs opacity-40 text-center">
        {visibleMessages.length} message
        {visibleMessages.length !== 1 ? "s" : ""} · code{" "}
        <code className="font-bold tracking-wider">{code}</code>
      </div>
    </div>
  );
}
