"use client";

import { use, useState, useEffect, useRef } from "react";
import {
  useSession as useSessionData,
  useUpdateSession,
} from "@/lib/hooks/use-sessions";
import {
  useMessages,
  useUpdateMessage,
  useDeleteMessage,
  useUploadFile,
  useDeleteAllMessages,
} from "@/lib/hooks/use-messages";
import { useRealtime } from "@/lib/hooks/use-realtime";
import { parseThemeConfig } from "@/lib/schemas";
import { PageLoading } from "@/components/loading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MessageBubble } from "@/components/message-bubble";
import { SessionCodeDisplay } from "@/components/session-code-display";
import { ImageCropDialog } from "@/components/image-crop-dialog";
import {
  ArrowLeft,
  Save,
  Loader2,
  Wifi,
  WifiOff,
  Users,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { WSMessageType, type Message, type ThemeConfig } from "@/types";

// ---- Chat-overlay colour helpers ------------------------------------------
function parseOverlay(rgba: string): { hex: string; opacity: number } {
  const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return { hex: "#0f172a", opacity: 0.9 };
  const hex =
    "#" +
    [m[1], m[2], m[3]]
      .map((n) => parseInt(n).toString(16).padStart(2, "0"))
      .join("");
  return { hex, opacity: m[4] !== undefined ? parseFloat(m[4]) : 1 };
}
function buildOverlay(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}
// ---------------------------------------------------------------------------

// ---- Theme presets --------------------------------------------------------
// Curated palettes following UX/design best-practices for dark presentation screens.
const THEME_PRESETS = [
  {
    name: "Ocean Night",
    emoji: "🌊",
    theme: {
      primary: "#3b82f6",
      secondary: "#8b5cf6",
      background: "#0f172a",
      text: "#f1f5f9",
      chatOverlay: "rgba(15,23,42,0.92)",
      fontFamily: "var(--font-inter), sans-serif",
      fontSize: "16",
      chatPosition: "right",
    },
    overlay: { hex: "#0f172a", opacity: 0.92 },
  },
  {
    name: "Forest",
    emoji: "🌲",
    theme: {
      primary: "#22c55e",
      secondary: "#16a34a",
      background: "#052e16",
      text: "#f0fdf4",
      chatOverlay: "rgba(5,46,22,0.92)",
      fontFamily: "var(--font-inter), sans-serif",
      fontSize: "16",
      chatPosition: "right",
    },
    overlay: { hex: "#052e16", opacity: 0.92 },
  },
  {
    name: "Sunset",
    emoji: "🌅",
    theme: {
      primary: "#f97316",
      secondary: "#ec4899",
      background: "#1c0a00",
      text: "#fff7ed",
      chatOverlay: "rgba(28,10,0,0.9)",
      fontFamily: "var(--font-poppins), sans-serif",
      fontSize: "16",
      chatPosition: "right",
    },
    overlay: { hex: "#1c0a00", opacity: 0.9 },
  },
  {
    name: "Nordic",
    emoji: "❄️",
    theme: {
      primary: "#60a5fa",
      secondary: "#93c5fd",
      background: "#1e3a5f",
      text: "#e0f2fe",
      chatOverlay: "rgba(30,58,95,0.9)",
      fontFamily: "var(--font-inter), sans-serif",
      fontSize: "16",
      chatPosition: "right",
    },
    overlay: { hex: "#1e3a5f", opacity: 0.9 },
  },
  {
    name: "Neon",
    emoji: "⚡",
    theme: {
      primary: "#a855f7",
      secondary: "#06b6d4",
      background: "#09090b",
      text: "#fafafa",
      chatOverlay: "rgba(9,9,11,0.9)",
      fontFamily: "var(--font-montserrat), sans-serif",
      fontSize: "16",
      chatPosition: "right",
    },
    overlay: { hex: "#09090b", opacity: 0.9 },
  },
  {
    name: "Corporate",
    emoji: "🏢",
    theme: {
      primary: "#2563eb",
      secondary: "#64748b",
      background: "#0f1f3d",
      text: "#f8fafc",
      chatOverlay: "rgba(15,31,61,0.92)",
      fontFamily: "var(--font-roboto), sans-serif",
      fontSize: "15",
      chatPosition: "right",
    },
    overlay: { hex: "#0f1f3d", opacity: 0.92 },
  },
  {
    name: "Rose Gold",
    emoji: "🌸",
    theme: {
      primary: "#f43f5e",
      secondary: "#e879f9",
      background: "#1a0010",
      text: "#fff1f2",
      chatOverlay: "rgba(26,0,16,0.9)",
      fontFamily: "var(--font-poppins), sans-serif",
      fontSize: "16",
      chatPosition: "right",
    },
    overlay: { hex: "#1a0010", opacity: 0.9 },
  },
  {
    name: "Minimal Dark",
    emoji: "◾",
    theme: {
      primary: "#e2e8f0",
      secondary: "#94a3b8",
      background: "#18181b",
      text: "#f4f4f5",
      chatOverlay: "rgba(24,24,27,0.94)",
      fontFamily: "var(--font-inter), sans-serif",
      fontSize: "16",
      chatPosition: "right",
    },
    overlay: { hex: "#18181b", opacity: 0.94 },
  },
] as const;
// ---------------------------------------------------------------------------

const FONT_FAMILIES = [
  { label: "Inter", value: "var(--font-inter), sans-serif" },
  { label: "Roboto", value: "var(--font-roboto), sans-serif" },
  { label: "Poppins", value: "var(--font-poppins), sans-serif" },
  { label: "Montserrat", value: "var(--font-montserrat), sans-serif" },
  { label: "Open Sans", value: "var(--font-open-sans), sans-serif" },
  { label: "System UI", value: "system-ui, sans-serif" },
];

export default function SessionManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session, isLoading } = useSessionData(id);
  const { data: initialMessages = [] } = useMessages(id);
  const updateSession = useUpdateSession(id);
  const updateMessage = useUpdateMessage();
  const deleteMessage = useDeleteMessage();
  const deleteAllMessages = useDeleteAllMessages();
  const uploadFile = useUploadFile();

  const [messages, setMessages] = useState<Message[]>([]);
  const [title, setTitle] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [backgroundType, setBackgroundType] = useState<
    "color" | "image" | "video"
  >("color");
  const [backgroundUrl, setBackgroundUrl] = useState("");
  const [showQrCode, setShowQrCode] = useState(true);

  // Image crop dialog state
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState("");
  const [overlayColor, setOverlayColor] = useState("#0f172a");
  const [overlayOpacity, setOverlayOpacity] = useState(0.9);
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>({
    primary: "#3b82f6",
    secondary: "#8b5cf6",
    background: "#1e293b",
    text: "#f1f5f9",
    chatOverlay: "rgba(15,23,42,0.9)",
    fontFamily: "Inter, sans-serif",
    fontSize: "16",
    chatPosition: "right",
  });

  // Delete confirmation state
  const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null);
  const [deleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false);

  // Track whether the WS SESSION_JOINED has already seeded the message list.
  const wsJoinedRef = useRef(false);

  // Seed from REST API (source of truth — includes hidden messages).
  // Merge with any WS-only messages that arrived before REST finished loading.
  useEffect(() => {
    if (initialMessages.length > 0) {
      setMessages((prev) => {
        if (prev.length === 0) return initialMessages;
        // Merge: REST is the authoritative base (has hidden msgs too).
        // Append any messages that arrived via WS and are not yet in the REST result.
        const restIds = new Set(initialMessages.map((m) => m.id));
        const wsOnly = prev.filter((m) => !restIds.has(m.id));
        return [...initialMessages, ...wsOnly];
      });
    }
  }, [initialMessages]);

  useEffect(() => {
    if (session) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setTitle(session.title);
      setIsActive(session.isActive);
      setBackgroundType(session.backgroundType as "color" | "image" | "video");
      setBackgroundUrl(session.backgroundUrl || "");
      const tc = parseThemeConfig(session.themeConfig);
      setShowQrCode(tc.showQrCode !== false);
      setThemeConfig(tc);
      const { hex, opacity } = parseOverlay(
        tc.chatOverlay || "rgba(15,23,42,0.9)",
      );
      setOverlayColor(hex);
      setOverlayOpacity(opacity);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [session]);

  // ── Supabase Realtime real-time updates ───────────────────────────────────
  const { isConnected, isConnecting, disconnect, reconnect } = useRealtime({
    sessionId: session?.id ?? "",
    onMessage: (wsMsg) => {
      switch (wsMsg.type) {
        case WSMessageType.SESSION_JOINED:
          // useRealtime emits SESSION_JOINED with initial visible messages.
          // Only seed if the REST list is still empty.
          if (!wsJoinedRef.current) {
            wsJoinedRef.current = true;
            setMessages((prev) =>
              prev.length === 0 ? wsMsg.payload.messages || [] : prev,
            );
          }
          break;
        case WSMessageType.NEW_MESSAGE:
          setMessages((prev) => {
            // Deduplicate — ignore if somehow already present.
            if (prev.some((m) => m.id === wsMsg.payload.id)) return prev;
            return [...prev, wsMsg.payload];
          });
          break;
        case WSMessageType.MESSAGE_UPDATED:
          setMessages((prev) =>
            prev.map((m) =>
              m.id === wsMsg.payload.messageId ? { ...m, ...wsMsg.payload } : m,
            ),
          );
          break;
        case WSMessageType.MESSAGE_DELETED:
          setMessages((prev) =>
            prev.filter((m) => m.id !== wsMsg.payload.messageId),
          );
          break;
        case WSMessageType.ALL_MESSAGES_CLEARED:
          setMessages([]);
          break;
      }
    },
  });
  // ────────────────────────────────────────────────────────────────────────

  const handleSaveBasicSettings = async () => {
    await updateSession.mutateAsync({ title, isActive });
  };

  const handleSaveBackground = async () => {
    await updateSession.mutateAsync({
      backgroundType,
      backgroundUrl: backgroundUrl || null,
      themeConfig: { ...themeConfig },
    });
  };

  const handleSaveTheme = async () => {
    const chatOverlay = buildOverlay(overlayColor, overlayOpacity);
    await updateSession.mutateAsync({
      themeConfig: { ...themeConfig, chatOverlay },
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-selected after cancelling
    e.target.value = "";

    // Auto-detect file type based on MIME type
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      toast.error("Please select a valid image or video file");
      return;
    }

    if (isImage) {
      // Open crop dialog first — upload happens after the user confirms
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.readAsDataURL(file);
      });
      setCropSrc(dataUrl);
      setCropDialogOpen(true);
      return;
    }

    // Videos upload directly (no crop step)
    if (isVideo) {
      try {
        const result = await uploadFile.mutateAsync({ file, type: "video" });
        setBackgroundUrl(result.url);
        setBackgroundType("video");
        toast.success("Video uploaded — click Save Background to apply");
      } catch {
        // Error handled by mutation
      }
    }
  };

  const handleCropConfirm = async (blob: Blob, previewUrl: string) => {
    setCropDialogOpen(false);
    setCropSrc("");
    try {
      const croppedFile = new File([blob], "background.webp", {
        type: "image/webp",
      });
      const result = await uploadFile.mutateAsync({
        file: croppedFile,
        type: "image",
      });
      // Revoke the temporary object URL after we have the server URL
      URL.revokeObjectURL(previewUrl);
      setBackgroundUrl(result.url);
      setBackgroundType("image");
      toast.success("Image uploaded — click Save Background to apply");
    } catch {
      // Error handled by mutation
    }
  };

  const handleToggleVisibility = async (
    messageId: string,
    isVisible: boolean,
  ) => {
    await updateMessage.mutateAsync({
      messageId,
      sessionId: id,
      updates: { isVisible },
    });
  };

  const handleTogglePin = async (messageId: string, isPinned: boolean) => {
    await updateMessage.mutateAsync({
      messageId,
      sessionId: id,
      updates: { isPinned },
    });
  };

  const handleDeleteMessage = (messageId: string) => {
    setDeleteMessageId(messageId);
  };

  const confirmDeleteMessage = async () => {
    if (!deleteMessageId) return;
    await deleteMessage.mutateAsync({
      messageId: deleteMessageId,
      sessionId: id,
    });
    setDeleteMessageId(null);
  };

  if (isLoading || !session) {
    return <PageLoading />;
  }

  const joinUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/join/${session.code}`;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Manage Session</h1>
              <p className="text-sm text-muted-foreground">{session.title}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {isConnected ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-green-600 border-green-300 hover:text-red-600 hover:border-red-300"
                  onClick={disconnect}
                  title="Click to disconnect"
                >
                  <Wifi className="h-3 w-3" />
                  Live
                </Button>
              ) : isConnecting ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-muted-foreground"
                  disabled
                >
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Connecting…
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-red-600 border-red-300 hover:text-green-600 hover:border-green-300"
                  onClick={reconnect}
                  title="Click to reconnect"
                >
                  <WifiOff className="h-3 w-3" />
                  Disconnected
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="messages" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="messages">Messages</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
                <TabsTrigger value="theme">Theme</TabsTrigger>
              </TabsList>

              {/* Messages Tab */}
              <TabsContent value="messages" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>Chat Moderation</CardTitle>
                        <CardDescription>
                          Manage messages, hide inappropriate content, or pin
                          important messages
                        </CardDescription>
                      </div>
                    </div>
                    {/* Inline stats bar */}
                    <div className="flex flex-wrap items-center gap-3 pt-2 border-t mt-2">
                      <div className="flex items-center gap-1.5 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">
                          {session._count?.participants ?? 0}
                        </span>
                        <span className="text-muted-foreground">
                          participants
                        </span>
                      </div>
                      <div className="w-px h-4 bg-border" />
                      <div className="flex items-center gap-1.5 text-sm">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{messages.length}</span>
                        <span className="text-muted-foreground">messages</span>
                      </div>
                      <div className="w-px h-4 bg-border" />
                      <Badge
                        variant={session.isActive ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {session.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <div className="ml-auto flex items-center gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteAllConfirmOpen(true)}
                          disabled={messages.length === 0}
                          className="text-xs"
                        >
                          Delete All
                        </Button>
                        <Link href={`/admin/sessions/${id}/participants`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                          >
                            <Users className="h-3.5 w-3.5" />
                            View Participants
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
                    {messages.length > 0 ? (
                      messages.map((message) => (
                        <MessageBubble
                          key={message.id}
                          message={message}
                          showActions
                          onToggleVisibility={(id, isVisible) =>
                            handleToggleVisibility(id, isVisible)
                          }
                          onTogglePin={(id, isPinned) =>
                            handleTogglePin(id, isPinned)
                          }
                          onDelete={(id) => handleDeleteMessage(id)}
                        />
                      ))
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        <p>No messages yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Session Settings</CardTitle>
                    <CardDescription>
                      Configure basic session settings
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="session-title">Session Title</Label>
                      <Input
                        id="session-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength={100}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Session Status</Label>
                        <p className="text-sm text-muted-foreground">
                          {isActive
                            ? "Session is active and accepting participants"
                            : "Session is inactive"}
                        </p>
                      </div>
                      <Switch
                        checked={isActive}
                        onCheckedChange={setIsActive}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Show QR Code on Presenter</Label>
                        <p className="text-sm text-muted-foreground">
                          {showQrCode
                            ? "QR code and join code visible on presenter"
                            : "QR code hidden on presenter"}
                        </p>
                      </div>
                      <Switch
                        checked={showQrCode}
                        onCheckedChange={async (v) => {
                          setShowQrCode(v);
                          setThemeConfig((prev) => ({
                            ...prev,
                            showQrCode: v,
                          }));
                          await updateSession.mutateAsync({
                            themeConfig: { ...themeConfig, showQrCode: v },
                          });
                        }}
                      />
                    </div>

                    <Button
                      onClick={handleSaveBasicSettings}
                      disabled={updateSession.isPending}
                    >
                      {updateSession.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Settings
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Theme Tab */}
              <TabsContent value="theme" className="space-y-4">
                {/* ── Background ───────────────────────────────────── */}
                <Card>
                  <CardHeader>
                    <CardTitle>Background</CardTitle>
                    <CardDescription>
                      Customize the presenter view background
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Background Type</Label>
                      <Select
                        value={backgroundType}
                        onValueChange={(value: "color" | "image" | "video") => {
                          setBackgroundType(value);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="color">Solid Color</SelectItem>
                          <SelectItem value="image">Image</SelectItem>
                          <SelectItem value="video">Video</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {backgroundType === "image" && (
                      <div className="space-y-3">
                        <Label htmlFor="image-upload">Upload Image</Label>
                        <Input
                          id="image-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          disabled={uploadFile.isPending}
                        />
                      </div>
                    )}

                    {backgroundType === "video" && (
                      <div className="space-y-2">
                        <Label htmlFor="video-upload">Upload Video</Label>
                        <Input
                          id="video-upload"
                          type="file"
                          accept="video/*,audio/*"
                          onChange={handleFileUpload}
                          disabled={uploadFile.isPending}
                        />
                        {backgroundUrl && (
                          <div className="mt-2">
                            <video
                              src={backgroundUrl}
                              className="w-full h-40 rounded-lg"
                              controls
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {backgroundType === "color" && (
                      <p className="text-sm text-muted-foreground">
                        Using theme background color
                      </p>
                    )}

                    <Button
                      onClick={handleSaveBackground}
                      disabled={updateSession.isPending}
                    >
                      {updateSession.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Background
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* ── Template Presets ─────────────────────────────── */}
                <Card>
                  <CardHeader>
                    <CardTitle>Template Themes</CardTitle>
                    <CardDescription>
                      Pick a curated palette — all colors are applied at once
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {THEME_PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => {
                            setThemeConfig({ ...preset.theme });
                            setOverlayColor(preset.overlay.hex);
                            setOverlayOpacity(preset.overlay.opacity);
                          }}
                          className="group relative rounded-lg overflow-hidden border-2 border-transparent hover:border-primary focus:outline-none focus:border-primary transition-all"
                          style={{ background: preset.theme.background }}
                        >
                          {/* Mini colour preview */}
                          <div className="h-14 flex items-end p-2 gap-1">
                            <div
                              className="h-4 w-4 rounded-full opacity-90"
                              style={{ background: preset.theme.primary }}
                            />
                            <div
                              className="h-3 w-3 rounded-full opacity-70"
                              style={{ background: preset.theme.secondary }}
                            />
                          </div>
                          <div
                            className="px-2 py-1.5 text-left"
                            style={{
                              background: buildOverlay(
                                preset.overlay.hex,
                                preset.overlay.opacity,
                              ),
                              color: preset.theme.text,
                            }}
                          >
                            <p className="text-xs font-semibold truncate">
                              {preset.emoji} {preset.name}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* ── Presenter Screen Colors ───────────────────────── */}
                <Card>
                  <CardHeader>
                    <CardTitle>Presenter Screen</CardTitle>
                    <CardDescription>
                      Colors, typography, and stage background
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {/* Colors grid */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        Colors
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          {
                            id: "primary-color",
                            label: "Primary",
                            key: "primary" as const,
                          },
                          {
                            id: "secondary-color",
                            label: "Secondary / Accent",
                            key: "secondary" as const,
                          },
                          {
                            id: "background-color",
                            label: "Stage Background",
                            key: "background" as const,
                          },
                          {
                            id: "text-color",
                            label: "Text",
                            key: "text" as const,
                          },
                        ].map(({ id, label, key }) => (
                          <div key={id} className="space-y-1.5">
                            <Label htmlFor={id} className="text-xs">
                              {label}
                            </Label>
                            <div className="flex items-center gap-2">
                              <Input
                                id={id}
                                type="color"
                                className="w-10 h-8 p-0.5 cursor-pointer rounded"
                                value={themeConfig[key]}
                                onChange={(e) =>
                                  setThemeConfig({
                                    ...themeConfig,
                                    [key]: e.target.value,
                                  })
                                }
                              />
                              <span className="text-xs font-mono text-muted-foreground">
                                {themeConfig[key]}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Typography */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        Typography
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Font Family</Label>
                          <Select
                            value={
                              themeConfig.fontFamily || "Inter, sans-serif"
                            }
                            onValueChange={(value) =>
                              setThemeConfig({
                                ...themeConfig,
                                fontFamily: value,
                              })
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FONT_FAMILIES.map((f) => (
                                <SelectItem
                                  key={f.value}
                                  value={f.value}
                                  style={{ fontFamily: f.value }}
                                >
                                  {f.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">
                            Font Size — {themeConfig.fontSize}px
                          </Label>
                          <div className="pt-1">
                            <input
                              type="range"
                              min="12"
                              max="24"
                              step="1"
                              value={themeConfig.fontSize}
                              onChange={(e) =>
                                setThemeConfig({
                                  ...themeConfig,
                                  fontSize: e.target.value,
                                })
                              }
                              className="w-full h-2 accent-primary cursor-pointer"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                              <span>12px</span>
                              <span>24px</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* ── Chat Panel ───────────────────────────────────── */}
                <Card>
                  <CardHeader>
                    <CardTitle>Chat Panel</CardTitle>
                    <CardDescription>
                      Overlay appearance and position on screen
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {/* Overlay */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        Overlay Style
                      </p>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 shrink-0">
                          <Input
                            type="color"
                            className="w-10 h-8 p-0.5 cursor-pointer rounded"
                            value={overlayColor}
                            onChange={(e) => setOverlayColor(e.target.value)}
                          />
                          <span className="text-xs text-muted-foreground">
                            Color
                          </span>
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Opacity</span>
                            <span className="font-medium">
                              {Math.round(overlayOpacity * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={overlayOpacity}
                            onChange={(e) =>
                              setOverlayOpacity(parseFloat(e.target.value))
                            }
                            className="w-full h-2 accent-primary cursor-pointer"
                          />
                        </div>
                        {/* Swatch preview */}
                        <div
                          className="w-10 h-8 rounded border shrink-0"
                          style={{
                            background: buildOverlay(
                              overlayColor,
                              overlayOpacity,
                            ),
                          }}
                        />
                      </div>
                    </div>

                    {/* Position */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        Layout
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Panel Position</Label>
                          <Select
                            value={themeConfig.chatPosition}
                            onValueChange={(value) =>
                              setThemeConfig({
                                ...themeConfig,
                                chatPosition:
                                  value as ThemeConfig["chatPosition"],
                              })
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="right">
                                Right sidebar
                              </SelectItem>
                              <SelectItem value="left">Left sidebar</SelectItem>
                              <SelectItem value="bottom">Bottom bar</SelectItem>
                              <SelectItem value="top">Top bar</SelectItem>
                              <SelectItem value="center">
                                Center (floating)
                              </SelectItem>
                              <SelectItem value="full">Full screen</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* ── Live Preview ─────────────────────────────────── */}
                <Card>
                  <CardHeader>
                    <CardTitle>Live Preview</CardTitle>
                    <CardDescription>
                      Updates instantly as you adjust the settings above
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div
                      className="relative w-full overflow-hidden rounded-lg border select-none"
                      style={{
                        aspectRatio: "16/9",
                        background: themeConfig.background,
                      }}
                    >
                      {/* Stage background hint */}
                      <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

                      {/* Title badge */}
                      <div
                        className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          background: "rgba(0,0,0,0.55)",
                          color: themeConfig.text,
                        }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                        <span className="truncate max-w-[120px]">
                          {session.title}
                        </span>
                      </div>

                      {/* Chat overlay panel */}
                      <div
                        className={`absolute flex flex-col ${
                          themeConfig.chatPosition === "right"
                            ? "right-0 top-0 bottom-0 w-[28%]"
                            : themeConfig.chatPosition === "left"
                              ? "left-0 top-0 bottom-0 w-[28%]"
                              : themeConfig.chatPosition === "top"
                                ? "top-0 left-0 right-0 h-[30%]"
                                : themeConfig.chatPosition === "full"
                                  ? "inset-0"
                                  : themeConfig.chatPosition === "center"
                                    ? "top-[10%] left-[20%] right-[20%] bottom-[10%] rounded-lg"
                                    : "bottom-0 left-0 right-0 h-[30%]"
                        }`}
                        style={{
                          background: buildOverlay(
                            overlayColor,
                            overlayOpacity,
                          ),
                          color: themeConfig.text,
                          fontFamily: themeConfig.fontFamily,
                        }}
                      >
                        <div className="px-2 py-1 border-b border-white/10 flex-shrink-0 flex items-center justify-between">
                          <span className="font-bold text-[9px] tracking-wide">
                            CHAT
                          </span>
                          <span className="opacity-40 text-[8px]">
                            3 messages
                          </span>
                        </div>
                        <div className="flex-1 p-1.5 space-y-1 overflow-hidden">
                          {[
                            { name: "Alice", text: "Hello everyone! 👋" },
                            { name: "Bob", text: "Great presentation!" },
                            { name: "Carol", text: "Can you explain more?" },
                          ].map((m, i) => (
                            <div
                              key={i}
                              className="rounded px-1.5 py-1 text-[8px] leading-tight"
                              style={{ background: "rgba(255,255,255,0.07)" }}
                            >
                              <span className="opacity-55 font-semibold mr-1">
                                {m.name}
                              </span>
                              <span>{m.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Primary color accent dots */}
                      <div className="absolute bottom-2 right-2 flex gap-1">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ background: themeConfig.primary }}
                        />
                        <div
                          className="h-2 w-2 rounded-full opacity-60"
                          style={{ background: themeConfig.secondary }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Button
                  onClick={handleSaveTheme}
                  disabled={updateSession.isPending}
                  className="w-full"
                >
                  {updateSession.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Theme
                    </>
                  )}
                </Button>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <SessionCodeDisplay
              code={session.code}
              joinUrl={joinUrl}
              onSave={async (code) => {
                await updateSession.mutateAsync({ code });
              }}
            />
          </div>
        </div>
      </div>

      {/* Image crop dialog */}
      {cropDialogOpen && cropSrc && (
        <ImageCropDialog
          open={cropDialogOpen}
          imageSrc={cropSrc}
          aspect={16 / 9}
          onConfirm={handleCropConfirm}
          onClose={() => {
            setCropDialogOpen(false);
            setCropSrc("");
          }}
        />
      )}

      {/* Delete All Messages Confirmation Dialog */}
      <AlertDialog
        open={deleteAllConfirmOpen}
        onOpenChange={setDeleteAllConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Messages?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all {messages.length} messages in
              this session. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await deleteAllMessages.mutateAsync({ sessionId: id });
                setDeleteAllConfirmOpen(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete message confirmation dialog */}
      <Dialog
        open={!!deleteMessageId}
        onOpenChange={(open) => {
          if (!open) setDeleteMessageId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Message</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this message? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteMessageId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteMessage}
              disabled={deleteMessage.isPending}
            >
              {deleteMessage.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
