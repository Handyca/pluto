'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminLayout } from '@/components/admin-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, Wifi, Users, RefreshCw, Radio, Server } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface RoomStats {
  sessionId: string;
  clients: number;
  admins: number;
}

interface WsStats {
  available: boolean;
  totalConnections: number;
  activeRooms: number;
  rooms: RoomStats[];
}

interface ChangeEntry {
  time: Date;
  message: string;
  type: 'up' | 'down' | 'info';
}

const MAX_LOG = 100;

export default function WebSocketMonitorPage() {
  const [stats, setStats] = useState<WsStats | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [log, setLog] = useState<ChangeEntry[]>([]);
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
        } else {
          pushLog('Monitor started — polling every 5 s', 'info');
        }
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

  const logColor = { up: 'text-green-400', down: 'text-red-400', info: 'text-slate-400' } as const;

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
                    Live connection and session room stats
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6 flex items-center gap-4">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${stats == null ? 'bg-muted' : stats.available ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                  <Server className={`h-6 w-6 ${stats == null ? 'text-muted-foreground' : stats.available ? 'text-green-500' : 'text-red-500'}`} />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats == null ? '…' : stats.available ? 'Running' : 'Not available'}</p>
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

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Change Log</CardTitle>
                  <CardDescription>Connection and room events detected between polls</CardDescription>
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
