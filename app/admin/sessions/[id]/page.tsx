'use client';

import { use, useState, useEffect } from 'react';
import { useSession as useSessionData, useUpdateSession } from '@/lib/hooks/use-sessions';
import { useMessages, useUpdateMessage, useDeleteMessage, useUploadFile } from '@/lib/hooks/use-messages';
import { PageLoading } from '@/components/loading';
import { Button } from '@/components/ui/button';
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
  Upload,
  Save,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function SessionManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session, isLoading } = useSessionData(id);
  const { data: messages = [] } = useMessages(id);
  const updateSession = useUpdateSession(id);
  const updateMessage = useUpdateMessage();
  const deleteMessage = useDeleteMessage();
  const uploadFile = useUploadFile();

  const [title, setTitle] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [backgroundType, setBackgroundType] = useState<'color' | 'image' | 'video'>('color');
  const [backgroundUrl, setBackgroundUrl] = useState('');
  const [themeConfig, setThemeConfig] = useState({
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    background: '#1e293b',
    text: '#f1f5f9',
    chatOverlay: 'rgba(15,23,42,0.9)',
    fontFamily: 'Inter',
    fontSize: '16',
    chatPosition: 'right',
  });

  useEffect(() => {
    if (session) {
      setTitle(session.title);
      setIsActive(session.isActive);
      setBackgroundType(session.backgroundType as 'color' | 'image' | 'video');
      setBackgroundUrl(session.backgroundUrl || '');
      setThemeConfig(session.themeConfig as any);
    }
  }, [session]);

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
    await updateSession.mutateAsync({ themeConfig });
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
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="primary-color">Primary Color</Label>
                        <Input
                          id="primary-color"
                          type="color"
                          value={themeConfig.primary}
                          onChange={(e) => setThemeConfig({ ...themeConfig, primary: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="secondary-color">Secondary Color</Label>
                        <Input
                          id="secondary-color"
                          type="color"
                          value={themeConfig.secondary}
                          onChange={(e) => setThemeConfig({ ...themeConfig, secondary: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="background-color">Background Color</Label>
                        <Input
                          id="background-color"
                          type="color"
                          value={themeConfig.background}
                          onChange={(e) => setThemeConfig({ ...themeConfig, background: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="text-color">Text Color</Label>
                        <Input
                          id="text-color"
                          type="color"
                          value={themeConfig.text}
                          onChange={(e) => setThemeConfig({ ...themeConfig, text: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="font-size">Font Size</Label>
                      <Input
                        id="font-size"
                        type="number"
                        min="12"
                        max="24"
                        value={themeConfig.fontSize}
                        onChange={(e) => setThemeConfig({ ...themeConfig, fontSize: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Chat Position</Label>
                      <Select
                        value={themeConfig.chatPosition}
                        onValueChange={(value) => setThemeConfig({ ...themeConfig, chatPosition: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="right">Right</SelectItem>
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="bottom">Bottom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button onClick={handleSaveTheme} disabled={updateSession.isPending}>
                      {updateSession.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
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
