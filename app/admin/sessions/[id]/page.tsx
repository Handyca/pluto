'use client';

import { use, useState, useEffect, useRef } from 'react';
import { useSession as useSessionData, useUpdateSession } from '@/lib/hooks/use-sessions';
import { useMessages, useUpdateMessage, useDeleteMessage, useUploadFile } from '@/lib/hooks/use-messages';
import { useWebSocket } from '@/lib/hooks/use-websocket';
import { PageLoading } from '@/components/loading';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageBubble } from '@/components/message-bubble';
import { SessionCodeDisplay } from '@/components/session-code-display';
import {
  ArrowLeft,
  Save,
  Loader2,
  Wifi,
  WifiOff,
  Users,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { getWsUrl } from '@/lib/utils';
import { WSMessageType, type Message, type ThemeConfig } from '@/types';

// ---- Chat-overlay colour helpers ------------------------------------------
function parseOverlay(rgba: string): { hex: string; opacity: number } {
  const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return { hex: '#0f172a', opacity: 0.9 };
  const hex =
    '#' + [m[1], m[2], m[3]].map((n) => parseInt(n).toString(16).padStart(2, '0')).join('');
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
    name: 'Ocean Night',
    emoji: '🌊',
    theme: { primary: '#3b82f6', secondary: '#8b5cf6', background: '#0f172a', text: '#f1f5f9', chatOverlay: 'rgba(15,23,42,0.92)', fontFamily: 'Inter, sans-serif', fontSize: '16', chatPosition: 'right' },
    overlay: { hex: '#0f172a', opacity: 0.92 },
  },
  {
    name: 'Forest',
    emoji: '🌲',
    theme: { primary: '#22c55e', secondary: '#16a34a', background: '#052e16', text: '#f0fdf4', chatOverlay: 'rgba(5,46,22,0.92)', fontFamily: 'Inter, sans-serif', fontSize: '16', chatPosition: 'right' },
    overlay: { hex: '#052e16', opacity: 0.92 },
  },
  {
    name: 'Sunset',
    emoji: '🌅',
    theme: { primary: '#f97316', secondary: '#ec4899', background: '#1c0a00', text: '#fff7ed', chatOverlay: 'rgba(28,10,0,0.9)', fontFamily: 'Poppins, sans-serif', fontSize: '16', chatPosition: 'right' },
    overlay: { hex: '#1c0a00', opacity: 0.9 },
  },
  {
    name: 'Nordic',
    emoji: '❄️',
    theme: { primary: '#60a5fa', secondary: '#93c5fd', background: '#1e3a5f', text: '#e0f2fe', chatOverlay: 'rgba(30,58,95,0.9)', fontFamily: 'Inter, sans-serif', fontSize: '16', chatPosition: 'right' },
    overlay: { hex: '#1e3a5f', opacity: 0.9 },
  },
  {
    name: 'Neon',
    emoji: '⚡',
    theme: { primary: '#a855f7', secondary: '#06b6d4', background: '#09090b', text: '#fafafa', chatOverlay: 'rgba(9,9,11,0.9)', fontFamily: 'Montserrat, sans-serif', fontSize: '16', chatPosition: 'right' },
    overlay: { hex: '#09090b', opacity: 0.9 },
  },
  {
    name: 'Corporate',
    emoji: '🏢',
    theme: { primary: '#2563eb', secondary: '#64748b', background: '#0f1f3d', text: '#f8fafc', chatOverlay: 'rgba(15,31,61,0.92)', fontFamily: 'Roboto, sans-serif', fontSize: '15', chatPosition: 'right' },
    overlay: { hex: '#0f1f3d', opacity: 0.92 },
  },
  {
    name: 'Rose Gold',
    emoji: '🌸',
    theme: { primary: '#f43f5e', secondary: '#e879f9', background: '#1a0010', text: '#fff1f2', chatOverlay: 'rgba(26,0,16,0.9)', fontFamily: 'Poppins, sans-serif', fontSize: '16', chatPosition: 'right' },
    overlay: { hex: '#1a0010', opacity: 0.9 },
  },
  {
    name: 'Minimal Dark',
    emoji: '◾',
    theme: { primary: '#e2e8f0', secondary: '#94a3b8', background: '#18181b', text: '#f4f4f5', chatOverlay: 'rgba(24,24,27,0.94)', fontFamily: 'Inter, sans-serif', fontSize: '16', chatPosition: 'right' },
    overlay: { hex: '#18181b', opacity: 0.94 },
  },
] as const;
// ---------------------------------------------------------------------------

const FONT_FAMILIES = [
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Roboto', value: 'Roboto, sans-serif' },
  { label: 'Poppins', value: 'Poppins, sans-serif' },
  { label: 'Montserrat', value: 'Montserrat, sans-serif' },
  { label: 'Open Sans', value: 'Open Sans, sans-serif' },
  { label: 'System UI', value: 'system-ui, sans-serif' },
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
  const uploadFile = useUploadFile();

  const [messages, setMessages] = useState<Message[]>([]);
  const [title, setTitle] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [backgroundType, setBackgroundType] = useState<'color' | 'image' | 'video'>('color');
  const [backgroundUrl, setBackgroundUrl] = useState('');
  const [overlayColor, setOverlayColor] = useState('#0f172a');
  const [overlayOpacity, setOverlayOpacity] = useState(0.9);
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>({
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    background: '#1e293b',
    text: '#f1f5f9',
    chatOverlay: 'rgba(15,23,42,0.9)',
    fontFamily: 'Inter, sans-serif',
    fontSize: '16',
    chatPosition: 'right',
  });

  // Seed messages from initial API fetch; WS keeps them up-to-date after that.
  // Use a ref guard so this only runs once — avoids infinite loop caused by
  // initialMessages getting a new array reference on every render.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!seededRef.current && initialMessages.length > 0) {
      seededRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  useEffect(() => {
    if (session) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setTitle(session.title);
      setIsActive(session.isActive);
      setBackgroundType(session.backgroundType as 'color' | 'image' | 'video');
      setBackgroundUrl(session.backgroundUrl || '');
      const tc = (session.themeConfig as unknown as ThemeConfig) ?? ({} as ThemeConfig);
      setThemeConfig(tc);
      const { hex, opacity } = parseOverlay(tc.chatOverlay || 'rgba(15,23,42,0.9)');
      setOverlayColor(hex);
      setOverlayOpacity(opacity);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [session]);

  // ── WebSocket real-time updates ─────────────────────────────────────────
  const [wsUrl] = useState(() => (typeof window !== 'undefined' ? getWsUrl() : ''));
  const { sendMessage: sendWsMessage, isConnected } = useWebSocket({
    url: wsUrl,
    onMessage: (wsMsg) => {
      switch (wsMsg.type) {
        case WSMessageType.NEW_MESSAGE:
          setMessages((prev) => [...prev, wsMsg.payload]);
          break;
        case WSMessageType.MESSAGE_UPDATED:
          setMessages((prev) =>
            prev.map((m) =>
              m.id === wsMsg.payload.messageId ? { ...m, ...wsMsg.payload } : m
            )
          );
          break;
        case WSMessageType.MESSAGE_DELETED:
          setMessages((prev) => prev.filter((m) => m.id !== wsMsg.payload.messageId));
          break;
      }
    },
  });

  // Join the session room as admin so WS server routes events to this client.
  useEffect(() => {
    if (isConnected && session) {
      sendWsMessage({
        type: WSMessageType.JOIN_SESSION,
        payload: { sessionCode: session.code, isAdmin: true },
      });
    }
  }, [isConnected, session, sendWsMessage]);
  // ────────────────────────────────────────────────────────────────────────

  const handleSaveBasicSettings = async () => {
    await updateSession.mutateAsync({ title, isActive });
  };

  const handleSaveBackground = async () => {
    await updateSession.mutateAsync({ 
      backgroundType, 
      backgroundUrl: backgroundUrl || null,
    });
  };

  const handleSaveTheme = async () => {
    const chatOverlay = buildOverlay(overlayColor, overlayOpacity);
    await updateSession.mutateAsync({ themeConfig: { ...themeConfig, chatOverlay } });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await uploadFile.mutateAsync({ file, type });
      setBackgroundUrl(result.url);
      setBackgroundType(type);
      toast.success('File uploaded successfully');
    } catch {
      // Error handled by mutation
    }
  };

  const handleToggleVisibility = async (messageId: string, isVisible: boolean) => {
    await updateMessage.mutateAsync({ messageId, sessionId: id, updates: { isVisible } });
  };

  const handleTogglePin = async (messageId: string, isPinned: boolean) => {
    await updateMessage.mutateAsync({ messageId, sessionId: id, updates: { isPinned } });
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (confirm('Are you sure you want to delete this message?')) {
      await deleteMessage.mutateAsync({ messageId, sessionId: id });
    }
  };

  if (isLoading || !session) {
    return <PageLoading />;
  }

  const joinUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${session.code}`;

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
                <Badge variant="secondary" className="gap-1.5 text-green-600 border-green-200">
                  <Wifi className="h-3 w-3" />
                  Live
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1.5 text-muted-foreground">
                  <WifiOff className="h-3 w-3" />
                  Connecting…
                </Badge>
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
                          Manage messages, hide inappropriate content, or pin important messages
                        </CardDescription>
                      </div>
                    </div>
                    {/* Inline stats bar */}
                    <div className="flex flex-wrap items-center gap-3 pt-2 border-t mt-2">
                      <div className="flex items-center gap-1.5 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{session._count?.participants ?? 0}</span>
                        <span className="text-muted-foreground">participants</span>
                      </div>
                      <div className="w-px h-4 bg-border" />
                      <div className="flex items-center gap-1.5 text-sm">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{messages.length}</span>
                        <span className="text-muted-foreground">messages</span>
                      </div>
                      <div className="w-px h-4 bg-border" />
                      <Badge variant={session.isActive ? 'default' : 'secondary'} className="text-xs">
                        {session.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <div className="ml-auto">
                        <Link href={`/admin/sessions/${id}/participants`}>
                          <Button variant="outline" size="sm" className="gap-1.5">
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
                          onToggleVisibility={(id, isVisible) => handleToggleVisibility(id, isVisible)}
                          onTogglePin={(id, isPinned) => handleTogglePin(id, isPinned)}
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
                    <CardDescription>Configure basic session settings</CardDescription>
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
                          {isActive ? 'Session is active and accepting participants' : 'Session is inactive'}
                        </p>
                      </div>
                      <Switch
                        checked={isActive}
                        onCheckedChange={setIsActive}
                      />
                    </div>

                    <Button onClick={handleSaveBasicSettings} disabled={updateSession.isPending}>
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

                <Card>
                  <CardHeader>
                    <CardTitle>Background</CardTitle>
                    <CardDescription>Customize the presenter view background</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Background Type</Label>
                      <Select
                        value={backgroundType}
                        onValueChange={(value: 'color' | 'image' | 'video') => setBackgroundType(value)}
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

                    {backgroundType === 'image' && (
                      <div className="space-y-2">
                        <Label htmlFor="image-upload">Upload Image</Label>
                        <Input
                          id="image-upload"
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, 'image')}
                          disabled={uploadFile.isPending}
                        />
                        {backgroundUrl && (
                          <div className="mt-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={backgroundUrl} alt="Background preview" className="w-full h-40 object-cover rounded-lg" />
                          </div>
                        )}
                      </div>
                    )}

                    {backgroundType === 'video' && (
                      <div className="space-y-2">
                        <Label htmlFor="video-upload">Upload Video</Label>
                        <Input
                          id="video-upload"
                          type="file"
                          accept="video/*"
                          onChange={(e) => handleFileUpload(e, 'video')}
                          disabled={uploadFile.isPending}
                        />
                        {backgroundUrl && (
                          <div className="mt-2">
                            <video src={backgroundUrl} className="w-full h-40 rounded-lg" controls />
                          </div>
                        )}
                      </div>
                    )}

                    {backgroundType === 'color' && (
                      <p className="text-sm text-muted-foreground">
                        Using theme background color
                      </p>
                    )}

                    <Button onClick={handleSaveBackground} disabled={updateSession.isPending}>
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
              </TabsContent>

              {/* Theme Tab */}
              <TabsContent value="theme" className="space-y-4">
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
                            <div className="h-4 w-4 rounded-full opacity-90" style={{ background: preset.theme.primary }} />
                            <div className="h-3 w-3 rounded-full opacity-70" style={{ background: preset.theme.secondary }} />
                          </div>
                          <div
                            className="px-2 py-1.5 text-left"
                            style={{ background: buildOverlay(preset.overlay.hex, preset.overlay.opacity), color: preset.theme.text }}
                          >
                            <p className="text-xs font-semibold truncate">{preset.emoji} {preset.name}</p>
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
                    <CardDescription>Colors, typography, and stage background</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {/* Colors grid */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Colors</p>
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { id: 'primary-color', label: 'Primary', key: 'primary' as const },
                          { id: 'secondary-color', label: 'Secondary / Accent', key: 'secondary' as const },
                          { id: 'background-color', label: 'Stage Background', key: 'background' as const },
                          { id: 'text-color', label: 'Text', key: 'text' as const },
                        ].map(({ id, label, key }) => (
                          <div key={id} className="space-y-1.5">
                            <Label htmlFor={id} className="text-xs">{label}</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                id={id}
                                type="color"
                                className="w-10 h-8 p-0.5 cursor-pointer rounded"
                                value={themeConfig[key]}
                                onChange={(e) => setThemeConfig({ ...themeConfig, [key]: e.target.value })}
                              />
                              <span className="text-xs font-mono text-muted-foreground">{themeConfig[key]}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Typography */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Typography</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Font Family</Label>
                          <Select
                            value={themeConfig.fontFamily || 'Inter, sans-serif'}
                            onValueChange={(value) => setThemeConfig({ ...themeConfig, fontFamily: value })}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FONT_FAMILIES.map((f) => (
                                <SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                                  {f.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Font Size — {themeConfig.fontSize}px</Label>
                          <div className="pt-1">
                            <input
                              type="range"
                              min="12"
                              max="24"
                              step="1"
                              value={themeConfig.fontSize}
                              onChange={(e) => setThemeConfig({ ...themeConfig, fontSize: e.target.value })}
                              className="w-full h-2 accent-primary cursor-pointer"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                              <span>12px</span><span>24px</span>
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
                    <CardDescription>Overlay appearance and position on screen</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {/* Overlay */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Overlay Style</p>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 shrink-0">
                          <Input
                            type="color"
                            className="w-10 h-8 p-0.5 cursor-pointer rounded"
                            value={overlayColor}
                            onChange={(e) => setOverlayColor(e.target.value)}
                          />
                          <span className="text-xs text-muted-foreground">Color</span>
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Opacity</span>
                            <span className="font-medium">{Math.round(overlayOpacity * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={overlayOpacity}
                            onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                            className="w-full h-2 accent-primary cursor-pointer"
                          />
                        </div>
                        {/* Swatch preview */}
                        <div
                          className="w-10 h-8 rounded border shrink-0"
                          style={{ background: buildOverlay(overlayColor, overlayOpacity) }}
                        />
                      </div>
                    </div>

                    {/* Position */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Layout</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Panel Position</Label>
                          <Select
                            value={themeConfig.chatPosition}
                            onValueChange={(value) => setThemeConfig({ ...themeConfig, chatPosition: value as ThemeConfig['chatPosition'] })}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="right">Right sidebar</SelectItem>
                              <SelectItem value="left">Left sidebar</SelectItem>
                              <SelectItem value="bottom">Bottom bar</SelectItem>
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
                    <CardDescription>Faithful 16:9 replica of the actual presenter screen</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div
                      className="relative w-full overflow-hidden rounded-lg border"
                      style={{ aspectRatio: '16/9', background: themeConfig.background }}
                    >
                      {/* Background image/video preview */}
                      {(backgroundType === 'image' || backgroundType === 'video') && backgroundUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={backgroundUrl}
                          alt="Background"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      )}

                      {/* Session info — top left */}
                      <div className="absolute top-[8%] left-[2%] z-10">
                        <div
                          className="bg-black/50 rounded p-[4px_8px] max-w-[35%]"
                          style={{ color: themeConfig.text, fontFamily: themeConfig.fontFamily }}
                        >
                          <p className="text-[9px] font-bold leading-tight truncate">{title || session.title}</p>
                          <div className="flex items-center gap-1 mt-[2px]">
                            <div className="h-[5px] w-[5px] rounded-full bg-green-400" />
                            <span className="text-[7px] opacity-80">Live</span>
                          </div>
                        </div>
                      </div>

                      {/* QR + Code — bottom left (mirrors presenter page) */}
                      <div className="absolute bottom-[6%] left-[2%] z-10">
                        <div className="bg-black/60 rounded-lg p-1.5 flex flex-col items-center gap-0.5">
                          <div className="w-[22px] h-[22px] bg-white rounded-sm" />
                          <p className="text-[6px] text-gray-300 leading-none">or code</p>
                          <code className="text-[8px] font-bold text-white tracking-widest">{session.code}</code>
                        </div>
                      </div>

                      {/* Chat panel */}
                      <div
                        className={`absolute flex flex-col ${
                          themeConfig.chatPosition === 'right'
                            ? 'right-0 top-0 bottom-0 w-[28%]'
                            : themeConfig.chatPosition === 'left'
                            ? 'left-0 top-0 bottom-0 w-[28%]'
                            : 'bottom-0 left-0 right-0 h-[38%]'
                        }`}
                        style={{
                          background: buildOverlay(overlayColor, overlayOpacity),
                          fontFamily: themeConfig.fontFamily,
                          color: themeConfig.text,
                        }}
                      >
                        <div className="px-2 py-1 border-b border-white/10">
                          <p className="text-[8px] font-bold">Chat</p>
                          <p className="text-[7px] opacity-60">3 messages</p>
                        </div>
                        <div className="flex-1 overflow-hidden p-1.5 space-y-1.5">
                          {[
                            { name: 'Alice', text: 'Hello everyone! 👋' },
                            { name: 'Bob', text: 'Great presentation!' },
                            { name: 'Carol', text: 'Love the theme ✨' },
                          ].map((msg) => (
                            <div key={msg.name} className="flex items-start gap-1">
                              <div
                                className="h-[14px] w-[14px] rounded-full flex-shrink-0 flex items-center justify-center text-[6px] font-bold text-white"
                                style={{ background: themeConfig.primary }}
                              >
                                {msg.name[0]}
                              </div>
                              <div>
                                <span className="text-[7px] font-semibold leading-none block" style={{ color: themeConfig.primary }}>
                                  {msg.name}
                                </span>
                                <p className="text-[7px] leading-tight opacity-90 mt-[1px]">{msg.text}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Button onClick={handleSaveTheme} disabled={updateSession.isPending} className="w-full">
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
            <SessionCodeDisplay code={session.code} joinUrl={joinUrl} />
          </div>
        </div>
      </div>
    </div>
  );
}
