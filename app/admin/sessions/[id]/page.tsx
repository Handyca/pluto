'use client';

import { use, useState, useEffect } from 'react';
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
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { getWsUrl } from '@/lib/utils';
import { WSMessageType, type Message } from '@/types';

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
  const router = useRouter();
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
  const [themeConfig, setThemeConfig] = useState({
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
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    if (session) {
      setTitle(session.title);
      setIsActive(session.isActive);
      setBackgroundType(session.backgroundType as 'color' | 'image' | 'video');
      setBackgroundUrl(session.backgroundUrl || '');
      const tc = (session.themeConfig as any) || {};
      setThemeConfig(tc);
      const { hex, opacity } = parseOverlay(tc.chatOverlay || 'rgba(15,23,42,0.9)');
      setOverlayColor(hex);
      setOverlayOpacity(opacity);
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
    } catch (error) {
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
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="messages">Messages</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
                <TabsTrigger value="background">Background</TabsTrigger>
                <TabsTrigger value="theme">Theme</TabsTrigger>
              </TabsList>

              {/* Messages Tab */}
              <TabsContent value="messages" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Chat Moderation</CardTitle>
                    <CardDescription>
                      Manage messages, hide inappropriate content, or pin important messages
                    </CardDescription>
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
              </TabsContent>

              {/* Background Tab */}
              <TabsContent value="background" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Background Settings</CardTitle>
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
                <Card>
                  <CardHeader>
                    <CardTitle>Theme Customization</CardTitle>
                    <CardDescription>Customize colors and appearance</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Color swatches */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="primary-color">Primary Color</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="primary-color"
                            type="color"
                            className="w-12 h-9 p-1 cursor-pointer"
                            value={themeConfig.primary}
                            onChange={(e) => setThemeConfig({ ...themeConfig, primary: e.target.value })}
                          />
                          <span className="text-sm font-mono text-muted-foreground">{themeConfig.primary}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="secondary-color">Secondary Color</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="secondary-color"
                            type="color"
                            className="w-12 h-9 p-1 cursor-pointer"
                            value={themeConfig.secondary}
                            onChange={(e) => setThemeConfig({ ...themeConfig, secondary: e.target.value })}
                          />
                          <span className="text-sm font-mono text-muted-foreground">{themeConfig.secondary}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="background-color">Background Color</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="background-color"
                            type="color"
                            className="w-12 h-9 p-1 cursor-pointer"
                            value={themeConfig.background}
                            onChange={(e) => setThemeConfig({ ...themeConfig, background: e.target.value })}
                          />
                          <span className="text-sm font-mono text-muted-foreground">{themeConfig.background}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="text-color">Text Color</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="text-color"
                            type="color"
                            className="w-12 h-9 p-1 cursor-pointer"
                            value={themeConfig.text}
                            onChange={(e) => setThemeConfig({ ...themeConfig, text: e.target.value })}
                          />
                          <span className="text-sm font-mono text-muted-foreground">{themeConfig.text}</span>
                        </div>
                      </div>
                    </div>

                    {/* Chat overlay */}
                    <div className="space-y-2">
                      <Label>Chat Panel Overlay</Label>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Input
                            type="color"
                            className="w-12 h-9 p-1 cursor-pointer"
                            value={overlayColor}
                            onChange={(e) => setOverlayColor(e.target.value)}
                          />
                          <span className="text-xs text-muted-foreground">Colour</span>
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Opacity</span>
                            <span>{Math.round(overlayOpacity * 100)}%</span>
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
                      </div>
                    </div>

                    {/* Font family */}
                    <div className="space-y-2">
                      <Label>Font Family</Label>
                      <Select
                        value={themeConfig.fontFamily || 'Inter, sans-serif'}
                        onValueChange={(value) => setThemeConfig({ ...themeConfig, fontFamily: value })}
                      >
                        <SelectTrigger>
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

                    {/* Font size */}
                    <div className="space-y-2">
                      <Label htmlFor="font-size">Font Size ({themeConfig.fontSize}px)</Label>
                      <input
                        id="font-size"
                        type="range"
                        min="12"
                        max="24"
                        step="1"
                        value={themeConfig.fontSize}
                        onChange={(e) => setThemeConfig({ ...themeConfig, fontSize: e.target.value })}
                        className="w-full h-2 accent-primary cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>12px</span><span>24px</span>
                      </div>
                    </div>

                    {/* Chat position */}
                    <div className="space-y-2">
                      <Label>Chat Panel Position</Label>
                      <Select
                        value={themeConfig.chatPosition}
                        onValueChange={(value) => setThemeConfig({ ...themeConfig, chatPosition: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="right">Right sidebar</SelectItem>
                          <SelectItem value="left">Left sidebar</SelectItem>
                          <SelectItem value="bottom">Bottom bar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Live preview */}
                    <div className="space-y-2">
                      <Label>Live Preview</Label>
                      <div
                        className="rounded-lg overflow-hidden border"
                        style={{
                          background: themeConfig.background,
                          color: themeConfig.text,
                          fontFamily: themeConfig.fontFamily,
                          fontSize: `${themeConfig.fontSize}px`,
                          minHeight: '120px',
                        }}
                      >
                        <div
                          className="p-3 h-full"
                          style={{ background: buildOverlay(overlayColor, overlayOpacity) }}
                        >
                          <p className="text-xs font-semibold mb-2 opacity-70">Chat preview</p>
                          <div className="space-y-2">
                            {[
                              { name: 'Alice', text: 'Hello everyone! 👋' },
                              { name: 'Bob', text: 'Great presentation!' },
                            ].map((msg) => (
                              <div key={msg.name} className="flex items-start gap-2">
                                <div
                                  className="h-6 w-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                                  style={{ background: themeConfig.primary, color: '#fff' }}
                                >
                                  {msg.name[0]}
                                </div>
                                <div>
                                  <span
                                    className="text-xs font-semibold"
                                    style={{ color: themeConfig.primary }}
                                  >
                                    {msg.name}
                                  </span>
                                  <p className="text-xs opacity-90">{msg.text}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <Button onClick={handleSaveTheme} disabled={updateSession.isPending}>
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
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <SessionCodeDisplay code={session.code} joinUrl={joinUrl} />

            <Card>
              <CardHeader>
                <CardTitle>Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Participants</span>
                  <span className="font-medium">{session._count?.participants || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Messages</span>
                  <span className="font-medium">{session._count?.messages || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium">{session.isActive ? 'Active' : 'Inactive'}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
