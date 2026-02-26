'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminLayout } from '@/components/admin-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Activity, Wifi, Users, RefreshCw, Radio, Server, Unplug, Settings2, Info, Globe, CheckCircle2, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface RoomStats {
  sessionId: string;
  clients: number;
  admins: number;
}

interface WsStats {
  available: boolean;
  totalConnections: number;
  activeRooms: number;
  queuedMessages?: number;
  isPaused: boolean;
  logLevel: string;
  serverPort: number | null;
  serverUrl: string | null;
  internalUrl: string | null;
  rooms: RoomStats[];
}

interface ChangeEntry {
  time: Date;
  message: string;
  type: 'up' | 'down' | 'info' | 'warn';
}

const MAX_LOG = 100;

export default function WebSocketMonitorPage() {
  const [stats, setStats] = useState<WsStats | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [log, setLog] = useState<ChangeEntry[]>([]);
  const [actionPending, setActionPending] = useState(false);
  // URL configuration
  const [urlInput, setUrlInput] = useState('');
  const [urlSaving, setUrlSaving] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const pushLog = (message: string, type: ChangeEntry['type'] = 'info') => {
    setLog((prev) => {
      const next = [...prev, { time: new Date(), message, type }];
      return next.length > MAX_LOG ? next.slice(-MAX_LOG) : next;
    });
  };

  const fetchStats = useCallback(async () => {
    setIsRefreshing(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/admin/websocket');
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const body = await res.json();
      if (!body.success) throw new Error(body.error ?? 'API error');

      const next: WsStats = body.data;
      setStats((prev) => {
        if (prev) {
          const delta = next.totalConnections - prev.totalConnections;
          if (delta > 0) pushLog(`+${delta} connection${delta > 1 ? 's' : ''} joined`, 'up');
          if (delta < 0) pushLog(`${delta} connection${Math.abs(delta) > 1 ? 's' : ''} left`, 'down');
          const roomDelta = next.activeRooms - prev.activeRooms;
          if (roomDelta > 0) pushLog(`+${roomDelta} session room${roomDelta > 1 ? 's' : ''} opened`, 'up');
          if (roomDelta < 0) pushLog(`${Math.abs(roomDelta)} session room${Math.abs(roomDelta) > 1 ? 's' : ''} closed`, 'down');
          if (prev.isPaused !== next.isPaused)
            pushLog(next.isPaused ? '⏸ Server paused' : '▶ Server resumed', next.isPaused ? 'warn' : 'up');
          if (prev.internalUrl !== next.internalUrl && next.internalUrl)
            pushLog(`🔗 WS URL updated to ${next.internalUrl}`, 'info');
        } else {
          pushLog('Monitor started — polling every 5 s', 'info');
        }
        // Initialise URL input with the current internal URL on first load
        if (!prev && next.internalUrl) setUrlInput(next.internalUrl);
        return next;
      });
      setLastUpdated(new Date());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFetchError(msg);
      pushLog(`Fetch error: ${msg}`, 'down');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    if (!autoRefresh) return;
    const id = setInterval(fetchStats, 5000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchStats]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  const sendAction = async (action: string, extra?: Record<string, string>) => {
    setActionPending(true);
    try {
      const res = await fetch('/api/admin/websocket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const body = await res.json();
      if (!body.success) throw new Error(body.error ?? 'Action failed');
      const next: WsStats = { ...body.data, available: true };
      setStats(next);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
      pushLog(`Action error: ${msg}`, 'down');
    } finally {
      setActionPending(false);
    }
  };

  const handlePauseToggle = async (checked: boolean) => {
    await sendAction(checked ? 'pause' : 'resume');
    pushLog(checked ? '⏸ Server paused by admin' : '▶ Server resumed by admin', checked ? 'warn' : 'up');
    toast.success(checked ? 'WebSocket server paused' : 'WebSocket server resumed');
  };

  const handleDisconnectAll = async () => {
    await sendAction('disconnect_all');
    pushLog('🔌 All clients disconnected by admin', 'warn');
    toast.success('All clients disconnected');
  };

  const handleLogLevel = async (level: string) => {
    await sendAction('set_log_level', { logLevel: level });
    pushLog(`📝 Log level changed to: ${level}`, 'info');
    toast.success(`Log level set to ${level}`);
  };

  const handleUpdateUrl = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    setUrlSaving(true);
    try {
      const res = await fetch('/api/admin/websocket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_url', internalUrl: trimmed }),
      });
      const body = await res.json();
      if (!body.success) throw new Error(body.error ?? 'Failed to update URL');
      const next: WsStats = { ...body.data };
      setStats(next);
      setLastUpdated(new Date());
      if (body.data.available) {
        pushLog(`🔗 WS server URL updated → ${trimmed}`, 'up');
        toast.success('WS server URL updated — connection verified ✓');
      } else {
        pushLog(`⚠️ URL saved but server at ${trimmed} is unreachable`, 'warn');
        toast.warning('URL saved but server is not reachable — check the address');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
      pushLog(`URL update error: ${msg}`, 'down');
    } finally {
      setUrlSaving(false);
    }
  };

  const logColor = {
    up: 'text-green-400',
    down: 'text-red-400',
    info: 'text-slate-400',
    warn: 'text-yellow-400',
  } as const;

  return (
    <AdminLayout>
      <div className="flex-1 overflow-auto">
        <div className="border-b bg-card sticky top-0 z-50">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">WebSocket Monitor</h1>
                  <p className="text-sm text-muted-foreground">
                    Live connection stats, server controls and settings
                    {lastUpdated && (
                      <span className="ml-2 text-xs">
                        · updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setAutoRefresh((v) => !v)}
                >
                  <Radio className={`h-4 w-4 ${autoRefresh ? 'text-green-500' : 'text-muted-foreground'}`} />
                  {autoRefresh ? 'Auto on' : 'Auto off'}
                </Button>
                <Button variant="outline" size="icon" onClick={fetchStats} disabled={isRefreshing} title="Refresh now">
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 space-y-6">
          {fetchError && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              Failed to fetch stats: {fetchError}
            </div>
          )}

          {/* Status cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6 flex items-center gap-4">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${
                  stats == null ? 'bg-muted' :
                  !stats.available ? 'bg-red-500/10' :
                  stats.isPaused ? 'bg-yellow-500/10' :
                  'bg-green-500/10'
                }`}>
                  <Server className={`h-6 w-6 ${
                    stats == null ? 'text-muted-foreground' :
                    !stats.available ? 'text-red-500' :
                    stats.isPaused ? 'text-yellow-500' :
                    'text-green-500'
                  }`} />
                </div>
                <div>
                  <p className="text-xl font-bold">
                    {stats == null ? '…' : !stats.available ? 'Not available' : stats.isPaused ? 'Paused' : 'Running'}
                  </p>
                  <p className="text-sm text-muted-foreground">Server status</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Wifi className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{stats?.totalConnections ?? '—'}</p>
                  <p className="text-sm text-muted-foreground">Active connections</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                  <Users className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{stats?.activeRooms ?? '—'}</p>
                  <p className="text-sm text-muted-foreground">Session rooms</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Server Controls + Connection Settings side-by-side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Server Controls */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-muted-foreground" />
                  <CardTitle>Server Controls</CardTitle>
                </div>
                <CardDescription>Pause the server or disconnect all active clients</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="pause-toggle" className="text-sm font-medium">
                      Server Active
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {stats?.isPaused
                        ? 'All clients disconnected — new joins rejected'
                        : 'Accepting connections normally'}
                    </p>
                  </div>
                  <Switch
                    id="pause-toggle"
                    checked={stats ? !stats.isPaused : true}
                    disabled={!stats?.available || actionPending}
                    onCheckedChange={(checked) => handlePauseToggle(!checked)}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Disconnect All Clients</Label>
                  <p className="text-xs text-muted-foreground">
                    Terminates every active WS connection. Server stays running — clients can reconnect.
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                    disabled={!stats?.available || (stats?.totalConnections ?? 0) === 0 || actionPending}
                    onClick={handleDisconnectAll}
                  >
                    <Unplug className="h-4 w-4" />
                    Disconnect all ({stats?.totalConnections ?? 0})
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Connection Settings */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <CardTitle>Connection Settings</CardTitle>
                </div>
                <CardDescription>Runtime configuration and current WS endpoint</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-muted-foreground">WS Endpoint</span>
                    <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                      {stats?.serverUrl ?? '—'}
                    </code>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-muted-foreground">Dedicated Port</span>
                    <Badge variant="outline" className="font-mono text-xs">
                      {stats?.serverPort ? `${stats.serverPort}` : 'Shared (same as HTTP)'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-muted-foreground">Queued messages</span>
                    <Badge variant="secondary" className="tabular-nums">
                      {stats?.queuedMessages ?? 0}
                    </Badge>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Log Level</Label>
                  <p className="text-xs text-muted-foreground">
                    Changes server output verbosity at runtime (no restart needed)
                  </p>
                  <Select
                    value={stats?.logLevel ?? 'info'}
                    disabled={!stats?.available || actionPending}
                    onValueChange={handleLogLevel}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debug">debug — very verbose</SelectItem>
                      <SelectItem value="info">info — normal</SelectItem>
                      <SelectItem value="warn">warn — warnings + errors only</SelectItem>
                      <SelectItem value="error">error — errors only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* WS Server URL Configuration */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <CardTitle>WebSocket Server URL</CardTitle>
              </div>
              <CardDescription>
                The HTTP management URL Next.js uses to reach the standalone WS server.
                Update this when the WS server moves to a different host or port without redeploying.
                The change is saved to <code className="text-xs bg-muted px-1 rounded">cache/ws-config.json</code> and takes effect immediately.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1.5 p-3 rounded-lg bg-muted/40">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current Internal URL</p>
                  <code className="font-mono text-sm break-all">{stats?.internalUrl ?? '—'}</code>
                  <p className="text-xs text-muted-foreground mt-1">Used by Next.js API routes to call the WS management API</p>
                </div>
                <div className="space-y-1.5 p-3 rounded-lg bg-muted/40">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Public WS Endpoint</p>
                  <code className="font-mono text-sm break-all">{stats?.serverUrl ?? '—'}</code>
                  <p className="text-xs text-muted-foreground mt-1">URL browsers connect to — set <code className="bg-muted px-1 rounded">NEXT_PUBLIC_WS_URL</code> for Vercel</p>
                </div>
              </div>

              {/* Status indicator */}
              <div className="flex items-center gap-2 text-sm">
                {stats == null ? null : stats.available ? (
                  <><CheckCircle2 className="h-4 w-4 text-green-500" /><span className="text-green-600 dark:text-green-400">Server reachable</span></>
                ) : (
                  <><XCircle className="h-4 w-4 text-red-500" /><span className="text-red-600 dark:text-red-400">Server unreachable at current URL</span></>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-sm font-medium">Update Internal URL</Label>
                <p className="text-xs text-muted-foreground">
                  Enter the base HTTP URL of the WS server (e.g. <code className="bg-muted px-1 rounded">http://localhost:3001</code> or
                  {' '}<code className="bg-muted px-1 rounded">https://ws.myapp.com</code>). The WS endpoint and management API must both be on this host.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="http://localhost:3001"
                    className="font-mono text-sm flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && handleUpdateUrl()}
                  />
                  <Button
                    onClick={handleUpdateUrl}
                    disabled={urlSaving || !urlInput.trim() || urlInput.trim() === stats?.internalUrl}
                    className="shrink-0"
                  >
                    {urlSaving ? 'Testing…' : 'Save & Test'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  💡 <strong>Vercel deployment:</strong> set{' '}
                  <code className="bg-muted px-1 rounded">WS_INTERNAL_URL</code> and{' '}
                  <code className="bg-muted px-1 rounded">NEXT_PUBLIC_WS_URL</code> in your Vercel project
                  environment variables instead of using this form.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Active Rooms */}
          <Card>
            <CardHeader>
              <CardTitle>Active Session Rooms</CardTitle>
              <CardDescription>One room per live session — refreshes every 5 s</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {!stats || stats.rooms.length === 0 ? (
                <p className="text-center text-muted-foreground py-10 text-sm">
                  {stats?.available === false
                    ? 'WebSocket server is not available in this environment.'
                    : 'No active session rooms right now.'}
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
                      <th className="px-6 py-3 text-left font-medium">Session ID</th>
                      <th className="px-6 py-3 text-right font-medium">Total</th>
                      <th className="px-6 py-3 text-right font-medium">Admins</th>
                      <th className="px-6 py-3 text-right font-medium">Participants</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {stats.rooms.map((room) => (
                      <tr key={room.sessionId} className="hover:bg-muted/30">
                        <td className="px-6 py-4">
                          <code className="text-xs font-mono text-muted-foreground">
                            {room.sessionId.slice(0, 8)}…{room.sessionId.slice(-4)}
                          </code>
                        </td>
                        <td className="px-6 py-4 text-right font-semibold">{room.clients}</td>
                        <td className="px-6 py-4 text-right text-muted-foreground">{room.admins}</td>
                        <td className="px-6 py-4 text-right text-muted-foreground">{room.clients - room.admins}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* Change Log */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Change Log</CardTitle>
                  <CardDescription>Connection, room and admin action events</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setLog([])}>Clear</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-56 overflow-y-auto bg-slate-950 rounded-b-lg p-4 font-mono text-xs space-y-0.5">
                {log.length === 0 && <p className="text-slate-500">Waiting for changes…</p>}
                {log.map((entry, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-slate-500 shrink-0 tabular-nums">{entry.time.toLocaleTimeString()}</span>
                    <span className={logColor[entry.type]}>{entry.message}</span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}

