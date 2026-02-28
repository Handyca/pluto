"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useSessionByCode } from "@/lib/hooks/use-sessions";
import { PageLoading } from "@/components/loading";
import { VideoBackground } from "@/components/video-background";
import { MessageBubble } from "@/components/message-bubble";
import { useRealtime } from "@/lib/hooks/use-realtime";
import { WSMessageType, Message, ThemeConfig } from "@/types";
import { parseThemeConfig } from "@/lib/schemas";
import { AnimatePresence } from "framer-motion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ChevronUp,
  GripVertical,
  Maximize2,
  MessageSquare,
} from "lucide-react";

import QRCodeLib from "qrcode";

export default function PresenterPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const [messages, setMessages] = useState<Message[]>([]);
  const [themeConfig, setThemeConfig] = useState<ThemeConfig | null>(null);
  const [backgroundType, setBackgroundType] = useState<string>("color");
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [chatMinimized, setChatMinimized] = useState(false);
  // Draggable / resizable / dockable chat state
  const [chatFloating, setChatFloating] = useState(false);
  const [chatPos, setChatPos] = useState({ x: 0, y: 0 });
  const [chatSize, setChatSize] = useState({ w: 384, h: 600 });
  // Tracks the active docked edge — distinct from theme's chatPosition so dragging
  // to a new edge is reflected immediately without changing the saved theme.
  const [activeDock, setActiveDock] = useState<
    "left" | "right" | "top" | "bottom" | "center" | "full"
  >("right");
  // Tracks which dock zone edge the panel is hovering over while dragging (for visual hint)
  const [dragZone, setDragZone] = useState<
    "left" | "right" | "top" | "bottom" | null
  >(null);
  // Refs hold live values so pointer-move callbacks never see stale closures
  const chatFloatingRef = useRef(false);
  const chatPosRef = useRef({ x: 0, y: 0 });
  const chatSizeRef = useRef({ w: 384, h: 600 });
  const activeDockRef = useRef<
    "left" | "right" | "top" | "bottom" | "center" | "full"
  >("right");
  const dragRef = useRef<{
    sx: number;
    sy: number;
    ox: number;
    oy: number;
    live: boolean;
  } | null>(null);
  const resizeRef = useRef<{
    sx: number;
    sy: number;
    ow: number;
    oh: number;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch session data — poll every 5 s as a fallback for background/theme
  // changes that may be missed when the WS broadcast does not reach this client.
  const { data: sessionData, isLoading, error } = useSessionByCode(code, 5000);

  // Supabase Realtime connection — subscribes to session:{sessionData.id} channel.
  // Initial messages are delivered via a synthetic SESSION_JOINED event from the hook.
  const { isConnected } = useRealtime({
    sessionId: sessionData?.id ?? "",
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

        case WSMessageType.ALL_MESSAGES_CLEARED:
          setMessages([]);
          break;

        case WSMessageType.BACKGROUND_UPDATED:
          setBackgroundType(wsMessage.payload.backgroundType);
          setBackgroundUrl(wsMessage.payload.backgroundUrl ?? null);
          break;

        case WSMessageType.THEME_UPDATED:
          setThemeConfig(wsMessage.payload.themeConfig as ThemeConfig);
          break;
      }
    },
  });

  // Subscribe to session room and apply theme/bg when sessionData first loads.
  // (Re-runs on reconnect and on data changes.)
  useEffect(() => {
    if (!sessionData) return;

    /* eslint-disable react-hooks/set-state-in-effect */
    setThemeConfig(parseThemeConfig(sessionData.themeConfig));
    setBackgroundType(sessionData.backgroundType);
    setBackgroundUrl(sessionData.backgroundUrl ?? null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [sessionData]);

  // Polling sync — apply background / theme changes detected by the 5-second
  // refetch even when the WS broadcast is missed.  We track last-applied values
  // in refs so we don't clobber a more-recent WS-delivered update.
  const lastPolledBgType = useRef<string | null>(null);
  const lastPolledBgUrl = useRef<string | null | undefined>(null);
  const lastPolledTheme = useRef<string | null>(null);
  useEffect(() => {
    if (!sessionData) return;
    const polledBgType = sessionData.backgroundType;
    const polledBgUrl = sessionData.backgroundUrl ?? null;
    const polledTheme = JSON.stringify(sessionData.themeConfig);

    if (
      polledBgType !== lastPolledBgType.current ||
      polledBgUrl !== lastPolledBgUrl.current
    ) {
      lastPolledBgType.current = polledBgType;
      lastPolledBgUrl.current = polledBgUrl;
      setBackgroundType(polledBgType);
      setBackgroundUrl(polledBgUrl);
    }
    if (polledTheme !== lastPolledTheme.current) {
      lastPolledTheme.current = polledTheme;
      setThemeConfig(parseThemeConfig(sessionData.themeConfig));
    }
  }, [sessionData]);

  // Apply theme to CSS variables (--primary overrides Tailwind so all
  // text-primary / bg-primary / border-primary utilities match the theme).
  useEffect(() => {
    if (themeConfig) {
      const root = document.documentElement;
      root.style.setProperty("--theme-primary", themeConfig.primary);
      root.style.setProperty("--theme-secondary", themeConfig.secondary);
      root.style.setProperty("--theme-background", themeConfig.background);
      root.style.setProperty("--theme-text", themeConfig.text);
      root.style.setProperty("--theme-chat-overlay", themeConfig.chatOverlay);
      root.style.setProperty("--theme-font-family", themeConfig.fontFamily);
      root.style.setProperty("--theme-font-size", `${themeConfig.fontSize}px`);
      // Let Tailwind colour utilities reflect the presenter theme.
      root.style.setProperty("--primary", themeConfig.primary);

      // Cleanup: restore CSS variables when the presenter unmounts so the
      // admin panel theme is not corrupted when navigating back.
      return () => {
        root.style.removeProperty("--theme-primary");
        root.style.removeProperty("--theme-secondary");
        root.style.removeProperty("--theme-background");
        root.style.removeProperty("--theme-text");
        root.style.removeProperty("--theme-chat-overlay");
        root.style.removeProperty("--theme-font-family");
        root.style.removeProperty("--theme-font-size");
        root.style.removeProperty("--primary");
      };
    }
  }, [themeConfig]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/join/${code}`;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJoinUrl(url);
    QRCodeLib.toDataURL(url, {
      width: 180,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    }).then(setQrCode);
  }, [code]);

  // Derived state — computed here so hooks below can reference it
  const visibleMessages = messages.filter((msg) => msg.isVisible);
  const pinnedMessages = visibleMessages.filter((msg) => msg.isPinned);
  const regularMessages = visibleMessages.filter((msg) => !msg.isPinned);
  const chatPosition = (themeConfig?.chatPosition || "right") as
    | "left"
    | "right"
    | "bottom"
    | "top"
    | "center"
    | "full";
  const showTitle = themeConfig?.showTitle !== false;
  const showQrCode = themeConfig?.showQrCode !== false;

  // Auto-scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages.length]);

  // Reset chat floating position when chatPosition theme changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const pos =
      chatPosition === "right"
        ? { x: W - 384, y: 0 }
        : chatPosition === "left"
          ? { x: 0, y: 0 }
          : chatPosition === "top"
            ? { x: 0, y: 0 }
            : chatPosition === "full"
              ? { x: 0, y: 0 }
              : chatPosition === "center"
                ? {
                    x: Math.max(0, (W - 480) / 2),
                    y: Math.max(0, (H - 600) / 2),
                  }
                : { x: 0, y: H - 320 }; // bottom
    const size =
      chatPosition === "bottom"
        ? { w: W, h: 320 }
        : chatPosition === "top"
          ? { w: W, h: 320 }
          : chatPosition === "full"
            ? { w: W, h: H }
            : chatPosition === "center"
              ? { w: 480, h: 600 }
              : { w: 384, h: H }; // left / right
    setChatPos(pos);
    chatPosRef.current = pos;
    setChatSize(size);
    chatSizeRef.current = size;
    setChatFloating(chatPosition === "center");
    chatFloatingRef.current = chatPosition === "center";
    setActiveDock(chatPosition);
    activeDockRef.current = chatPosition;
  }, [chatPosition]);

  // ── Drag helpers ───────────────────────────────────────────────────────
  const DOCK_THRESHOLD = 80; // px from edge to snap-dock

  const setFloating = useCallback((v: boolean) => {
    chatFloatingRef.current = v;
    setChatFloating(v);
  }, []);

  const setPos = useCallback((p: { x: number; y: number }) => {
    chatPosRef.current = p;
    setChatPos(p);
  }, []);

  const setSize = useCallback((s: { w: number; h: number }) => {
    chatSizeRef.current = s;
    setChatSize(s);
  }, []);

  const setDock = useCallback((d: "left" | "right" | "top" | "bottom") => {
    activeDockRef.current = d;
    setActiveDock(d);
  }, []);

  const onDragPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest("button")) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      const W = window.innerWidth;
      const H = window.innerHeight;
      let ox = chatPosRef.current.x;
      let oy = chatPosRef.current.y;
      if (!chatFloatingRef.current) {
        // Compute pixel origin from the ACTIVE docked position (not themeConfig chatPosition
        // which may differ after the user has already dragged/re-docked the panel).
        const w = chatSizeRef.current.w;
        const h = chatSizeRef.current.h;
        const dock = activeDockRef.current;
        if (dock === "right") {
          ox = W - w;
          oy = 0;
        } else if (dock === "left") {
          ox = 0;
          oy = 0;
        } else if (dock === "top") {
          ox = 0;
          oy = 0;
        } else if (dock === "full") {
          ox = 0;
          oy = 0;
        } else if (dock === "center") {
          ox = chatPosRef.current.x;
          oy = chatPosRef.current.y;
        } else /* bottom */ {
          ox = 0;
          oy = H - h;
        }
      }
      dragRef.current = { sx: e.clientX, sy: e.clientY, ox, oy, live: false };
    },
    [],
  );

  const onDragPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.sx;
      const dy = e.clientY - dragRef.current.sy;
      if (!dragRef.current.live) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return; // dead-zone
        dragRef.current.live = true;
        setFloating(true);
      }
      const W = window.innerWidth;
      const H = window.innerHeight;
      const w = chatSizeRef.current.w;
      const h = chatSizeRef.current.h;
      const newX = Math.max(0, Math.min(W - w, dragRef.current.ox + dx));
      const newY = Math.max(0, Math.min(H - 40, dragRef.current.oy + dy));
      setPos({ x: newX, y: newY });
      // Update dock zone hint
      if (newX <= DOCK_THRESHOLD) setDragZone("left");
      else if (newX + w >= W - DOCK_THRESHOLD) setDragZone("right");
      else if (newY <= DOCK_THRESHOLD) setDragZone("top");
      else if (newY + h >= H - DOCK_THRESHOLD) setDragZone("bottom");
      else setDragZone(null);
    },
    [setFloating, setPos],
  );

  const onDragPointerUp = useCallback(() => {
    if (!dragRef.current?.live) {
      dragRef.current = null;
      return;
    }
    dragRef.current = null;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const { x, y } = chatPosRef.current;
    const { w, h } = chatSizeRef.current;
    // Snap to nearest edge if within threshold
    if (x <= DOCK_THRESHOLD) {
      setDock("left");
      setFloating(false);
      setPos({ x: 0, y: 0 });
      setSize({ w, h: H });
    } else if (x + w >= W - DOCK_THRESHOLD) {
      setDock("right");
      setFloating(false);
      setPos({ x: W - w, y: 0 });
      setSize({ w, h: H });
    } else if (y <= DOCK_THRESHOLD) {
      setDock("top");
      setFloating(false);
      setPos({ x: 0, y: 0 });
      setSize({ w: W, h });
    } else if (y + h >= H - DOCK_THRESHOLD) {
      setDock("bottom");
      setFloating(false);
      setPos({ x: 0, y: H - h });
      setSize({ w: W, h });
    }
    // else: stay floating at current position
    setDragZone(null);
  }, [setDock, setFloating, setPos, setSize]);

  // ── Resize helpers ─────────────────────────────────────────────────────
  // Helper: pixel origin of the chat panel in its current docked state
  const getDockedPixelRect = useCallback(() => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const { w, h } = chatSizeRef.current;
    const dock = activeDockRef.current;
    if (dock === "right") return { x: W - w, y: 0, w, h: H };
    if (dock === "left") return { x: 0, y: 0, w, h: H };
    if (dock === "top") return { x: 0, y: 0, w: W, h };
    if (dock === "bottom") return { x: 0, y: H - h, w: W, h };
    // center / full / floating — use stored pos
    return { x: chatPosRef.current.x, y: chatPosRef.current.y, w, h };
  }, []);

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      // Anchor position before switching to floating so the panel doesn't jump
      if (!chatFloatingRef.current) {
        const rect = getDockedPixelRect();
        setPos({ x: rect.x, y: rect.y });
        setSize({ w: rect.w, h: rect.h });
        chatSizeRef.current = { w: rect.w, h: rect.h };
      }
      resizeRef.current = {
        sx: e.clientX,
        sy: e.clientY,
        ow: chatSizeRef.current.w,
        oh: chatSizeRef.current.h,
      };
      setFloating(true);
    },
    [setFloating, setPos, setSize, getDockedPixelRect],
  );

  const onResizePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!resizeRef.current) return;
      setSize({
        w: Math.max(
          240,
          resizeRef.current.ow + (e.clientX - resizeRef.current.sx),
        ),
        h: Math.max(
          160,
          resizeRef.current.oh + (e.clientY - resizeRef.current.sy),
        ),
      });
    },
    [setSize],
  );

  const onResizePointerUp = useCallback(() => {
    resizeRef.current = null;
  }, []);

  // Root-level pointer handlers catch fast drag/resize that overshoot the source element
  const onRootPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (dragRef.current) onDragPointerMove(e);
      else if (resizeRef.current) onResizePointerMove(e);
    },
    [onDragPointerMove, onResizePointerMove],
  );

  const onRootPointerUp = useCallback(() => {
    if (dragRef.current) onDragPointerUp();
    if (resizeRef.current) {
      resizeRef.current = null;
    }
  }, [onDragPointerUp]);

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
            The session code &quot;{code}&quot; does not exist or is no longer
            active.
          </p>
        </div>
      </div>
    );
  }

  // Chat overlay position + size — floating (dragged/resized) or CSS-class-based
  const chatBaseStyle = chatFloating
    ? {
        left: chatPos.x,
        top: chatPos.y,
        width: chatSize.w,
        height: chatSize.h,
        right: "auto" as const,
        bottom: "auto" as const,
      }
    : {};
  // Derive CSS class from activeDock (updated on drag-to-dock) so snapping to a
  // new edge is reflected immediately, independent of the saved theme position.
  const chatPositionClass = chatFloating
    ? ""
    : activeDock === "right"
      ? "right-0 top-0 bottom-0 w-96"
      : activeDock === "left"
        ? "left-0 top-0 bottom-0 w-96"
        : activeDock === "top"
          ? "top-0 left-0 right-0 h-80"
          : activeDock === "full"
            ? "inset-0"
            : "bottom-0 left-0 right-0 h-80"; // bottom (also default for center which is always floating)

  return (
    <div
      className="relative w-full h-screen overflow-hidden"
      style={{
        background: themeConfig?.background || "#1e293b",
        color: themeConfig?.text || "#f1f5f9",
        fontFamily: themeConfig?.fontFamily || "Inter",
        fontSize: themeConfig?.fontSize ? `${themeConfig.fontSize}px` : "16px",
      }}
      onPointerMove={onRootPointerMove}
      onPointerUp={onRootPointerUp}
    >
      {/* Background Layer */}
      <div className="absolute inset-0 z-0">
        {backgroundType === "video" && backgroundUrl && (
          <VideoBackground src={backgroundUrl} />
        )}
        {backgroundType === "image" && backgroundUrl && (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${backgroundUrl})`,
              backgroundSize:
                themeConfig?.bgObjectFit === "contain"
                  ? "contain"
                  : themeConfig?.bgObjectFit === "fill"
                    ? "100% 100%"
                    : "cover",
              backgroundPosition:
                themeConfig?.bgObjectPosition || "center center",
              backgroundRepeat: "no-repeat",
            }}
          />
        )}
      </div>

      {/* Dock zone hints — glow strips on edges when dragging near them */}
      {dragZone === "left" && (
        <div className="absolute left-0 top-0 bottom-0 w-2 bg-white/30 z-30 pointer-events-none transition-opacity" />
      )}
      {dragZone === "right" && (
        <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/30 z-30 pointer-events-none transition-opacity" />
      )}
      {dragZone === "top" && (
        <div className="absolute top-0 left-0 right-0 h-2 bg-white/30 z-30 pointer-events-none transition-opacity" />
      )}
      {dragZone === "bottom" && (
        <div className="absolute bottom-0 left-0 right-0 h-2 bg-white/30 z-30 pointer-events-none transition-opacity" />
      )}

      {/* Session info — compact status badge with popover tooltip */}
      {showTitle && (
        <div className="absolute top-4 left-4 z-20">
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5 hover:bg-black/70 transition-colors cursor-pointer select-none"
                style={{ color: themeConfig?.text || "#f1f5f9" }}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                    isConnected ? "bg-green-400 animate-pulse" : "bg-red-400"
                  }`}
                />
                <span className="text-sm font-medium max-w-[180px] truncate">
                  {sessionData.title}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="start"
              className="w-72 p-4 z-30"
            >
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Session
                  </p>
                  <h3 className="font-bold text-base leading-snug">
                    {sessionData.title}
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isConnected ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                  <span>
                    {isConnected ? "Live — Supabase connected" : "Disconnected"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground/70">
                      Code
                    </p>
                    <code className="font-bold text-foreground">{code}</code>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground/70">
                      Messages
                    </p>
                    <p className="font-semibold text-foreground">
                      {visibleMessages.length}
                    </p>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Session Code has been merged into the QR panel at bottom-left */}

      {/* Chat Overlay — draggable, resizable, hides when minimized */}
      {!chatMinimized && (
        <div
          className={`absolute ${chatPositionClass} z-20 flex flex-col shadow-2xl`}
          style={{
            ...chatBaseStyle,
            background: themeConfig?.chatOverlay || "rgba(15,23,42,0.9)",
            fontFamily: themeConfig?.fontFamily || "Inter, sans-serif",
            color: themeConfig?.text || "#f1f5f9",
          }}
        >
          {/* Drag header — pointerDown captures; move/up are handled at root level */}
          <div
            className="p-4 border-b border-white/10 flex items-center justify-between flex-shrink-0 cursor-grab active:cursor-grabbing select-none"
            onPointerDown={onDragPointerDown}
          >
            <div className="flex items-center gap-2 min-w-0">
              <GripVertical className="h-4 w-4 opacity-30 flex-shrink-0" />
              <div className="min-w-0">
                <h2 className="text-xl font-bold leading-none">Chat</h2>
                <p className="text-sm opacity-70 mt-0.5">
                  {visibleMessages.length} message
                  {visibleMessages.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => window.open(`/presenter/${code}/chat`, "_blank")}
                className="p-1.5 rounded hover:bg-white/10 transition-colors"
                title="Expand chat to full screen"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setChatMinimized(true)}
                className="p-1.5 rounded hover:bg-white/10 transition-colors"
                title="Minimize chat"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {pinnedMessages.length > 0 && (
              <div className="space-y-2 pb-4 border-b border-white/10">
                <h3 className="text-xs font-semibold opacity-50 uppercase tracking-wider">
                  Pinned
                </h3>
                <AnimatePresence mode="popLayout">
                  {pinnedMessages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                </AnimatePresence>
              </div>
            )}
            <AnimatePresence mode="popLayout">
              {regularMessages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
            </AnimatePresence>
            {messages.length === 0 && (
              <div className="text-center opacity-50 py-8">
                <p>No messages yet</p>
                <p className="text-sm mt-2">
                  Share the code {code} to let participants join
                </p>
              </div>
            )}
            {/* Auto-scroll anchor */}
            <div ref={messagesEndRef} />
          </div>

          {/* Resize corner grip — pointerDown captures; move/up are handled at root level */}
          <div
            className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-end justify-end p-1 opacity-40 hover:opacity-80 transition-opacity z-10"
            onPointerDown={onResizePointerDown}
            title="Drag to resize"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <path
                d="M9 1L1 9M9 5L5 9M9 9L9 9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      )}

      {/* Minimized restore tab */}
      {chatMinimized && (
        <button
          onClick={() => setChatMinimized(false)}
          className={`absolute z-20 flex items-center gap-1.5 px-3 py-2 text-sm font-medium hover:opacity-90 transition-opacity ${
            chatPosition === "right" ||
            chatPosition === "center" ||
            chatPosition === "full"
              ? "right-0 top-1/2 -translate-y-1/2 flex-col rounded-l-lg"
              : chatPosition === "left"
                ? "left-0 top-1/2 -translate-y-1/2 flex-col rounded-r-lg"
                : chatPosition === "top"
                  ? "top-0 left-1/2 -translate-x-1/2 flex-row rounded-b-lg"
                  : "bottom-0 left-1/2 -translate-x-1/2 flex-row rounded-t-lg"
          }`}
          style={{
            background: themeConfig?.chatOverlay || "rgba(15,23,42,0.9)",
            color: themeConfig?.text || "#f1f5f9",
          }}
          title="Restore chat"
        >
          <MessageSquare className="h-4 w-4 flex-shrink-0" />
          <span
            className={`text-xs font-semibold ${
              chatPosition === "bottom" ||
              chatPosition === "top" ||
              chatPosition === "full"
                ? ""
                : "[writing-mode:vertical-rl] rotate-180"
            }`}
          >
            Chat
          </span>
          {visibleMessages.length > 0 && (
            <span className="bg-primary text-primary-foreground text-xs rounded-full min-w-[1.1rem] h-[1.1rem] flex items-center justify-center px-0.5 leading-none">
              {visibleMessages.length}
            </span>
          )}
        </button>
      )}

      {/* Join QR Code + Session Code - Bottom Left */}
      {qrCode && showQrCode && (
        <div className="absolute bottom-4 left-4 z-10">
          <div className="bg-black/60 backdrop-blur-sm rounded-xl p-4 flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCode} alt="Join QR" className="w-32 h-32 rounded" />
            <div className="text-center">
              <p className="text-xs text-gray-300">or join with code</p>
              <code className="text-2xl font-bold tracking-widest text-white">
                {code}
              </code>
            </div>
            <p className="text-xs text-gray-400 truncate max-w-[9rem]">
              {joinUrl.replace(/^https?:\/\//, "")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
