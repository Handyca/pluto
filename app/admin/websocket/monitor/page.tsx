"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  Wifi,
  Users,
  RefreshCw,
  Radio,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface RoomStats {
  sessionId: string;
  sessionTitle: string;
  sessionCode: string;
  messageCount: number;
  participantCount: number;
}

interface RealtimeData {
  available: boolean;
  projectUrl: string;
  activeSessionCount: number;
  totalMessages: number;
  totalParticipants: number;
  rooms: RoomStats[];
}

interface LogEntry {
  time: Date;
  message: string;
  type: "up" | "down" | "info";
}

const MAX_LOG = 100;

export default function RealtimeMonitorPage() {
  const [data, setData] = useState<RealtimeData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  const pushLog = (message: string, type: LogEntry["type"] = "info") => {
    setLog((prev) => {
      const next = [...prev, { time: new Date(), message, type }];
      return next.length > MAX_LOG ? next.slice(-MAX_LOG) : next;
    });
  };

  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/admin/websocket");
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const body = await res.json();
      if (!body.success) throw new Error(body.error ?? "API error");

      const next: RealtimeData = body.data;
      setData((prev) => {
        if (prev) {
          const sessionDelta =
            next.activeSessionCount - prev.activeSessionCount;
          if (sessionDelta > 0)
            pushLog(
              `+${sessionDelta} active session${sessionDelta > 1 ? "s" : ""}`,
              "up",
            );
          if (sessionDelta < 0)
            pushLog(
              `${sessionDelta} session${Math.abs(sessionDelta) > 1 ? "s" : ""} closed`,
              "down",
            );
          const msgDelta = next.totalMessages - prev.totalMessages;
          if (msgDelta > 0)
            pushLog(`+${msgDelta} new message${msgDelta > 1 ? "s" : ""}`, "up");
        } else {
          pushLog("Monitor started — polling every 5 s", "info");
        }
        return next;
      });
      setLastUpdated(new Date());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFetchError(msg);
      pushLog(`Fetch error: ${msg}`, "down");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    if (!autoRefresh) return;
    const id = setInterval(fetchData, 5000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchData]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  const logColor = {
    up: "text-green-400",
    down: "text-red-400",
    info: "text-slate-400",
  } as const;

  return (
    <AdminLayout>
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="border-b bg-card sticky top-0 z-50">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Realtime Monitor</h1>
                  <p className="text-sm text-muted-foreground">
                    Supabase Realtime — live session stats
                    {lastUpdated && (
                      <span className="ml-2 text-xs">
                        · updated{" "}
                        {formatDistanceToNow(lastUpdated, { addSuffix: true })}
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
                  <Radio
                    className={`h-4 w-4 ${autoRefresh ? "text-green-500" : "text-muted-foreground"}`}
                  />
                  {autoRefresh ? "Auto on" : "Auto off"}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={fetchData}
                  disabled={isRefreshing}
                  title="Refresh now"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                  />
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
            {/* Supabase status */}
            <Card>
              <CardContent className="pt-6 flex items-center gap-4">
                <div
                  className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${data?.available ? "bg-green-500/10" : "bg-red-500/10"}`}
                >
                  {data?.available ? (
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-500" />
                  )}
                </div>
                <div>
                  <p className="text-xl font-bold">
                    {data == null
                      ? "…"
                      : data.available
                        ? "Connected"
                        : "Unavailable"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Supabase Realtime
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Active sessions */}
            <Card>
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Wifi className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-3xl font-bold">
                    {data?.activeSessionCount ?? "—"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Active sessions
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Total participants */}
            <Card>
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                  <Users className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-3xl font-bold">
                    {data?.totalParticipants ?? "—"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Total participants
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Supabase connection info */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <CardTitle>Supabase Realtime Configuration</CardTitle>
              </div>
              <CardDescription>
                Real-time events are broadcast via Supabase Realtime channels —
                no standalone WS server required.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 p-3 rounded-lg bg-muted/40">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Supabase Project URL
                  </p>
                  <code className="font-mono text-sm break-all">
                    {data?.projectUrl ||
                      process.env.NEXT_PUBLIC_SUPABASE_URL ||
                      "—"}
                  </code>
                </div>
                <div className="space-y-1.5 p-3 rounded-lg bg-muted/40">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Channel pattern
                  </p>
                  <code className="font-mono text-sm">
                    session:{"{"}sessionId{"}"}
                  </code>
                  <p className="text-xs text-muted-foreground mt-1">
                    One channel per active session
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {data?.available ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-green-600 dark:text-green-400">
                      Supabase URL is configured
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-red-600 dark:text-red-400">
                      Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
                      to enable broadcasting
                    </span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Active session rooms */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <div>
                  <CardTitle>Active Session Rooms</CardTitle>
                  <CardDescription>
                    Your currently active sessions — refreshes every 5 s
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {!data || data.rooms.length === 0 ? (
                <p className="text-center text-muted-foreground py-10 text-sm">
                  {!data?.available
                    ? "Supabase Realtime is not configured — check your env vars."
                    : "No active sessions right now."}
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
                      <th className="px-6 py-3 text-left font-medium">
                        Session
                      </th>
                      <th className="px-6 py-3 text-left font-medium">Code</th>
                      <th className="px-6 py-3 text-right font-medium">
                        Messages
                      </th>
                      <th className="px-6 py-3 text-right font-medium">
                        Participants
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.rooms.map((room) => (
                      <tr key={room.sessionId} className="hover:bg-muted/30">
                        <td className="px-6 py-4 font-medium">
                          {room.sessionTitle}
                        </td>
                        <td className="px-6 py-4">
                          <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                            {room.sessionCode}
                          </code>
                        </td>
                        <td className="px-6 py-4 text-right tabular-nums">
                          {room.messageCount}
                        </td>
                        <td className="px-6 py-4 text-right tabular-nums">
                          {room.participantCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* Change log */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Activity Log</CardTitle>
                  <CardDescription>
                    Session and message activity events
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setLog([])}>
                  Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-56 overflow-y-auto bg-slate-950 rounded-b-lg p-4 font-mono text-xs space-y-0.5">
                {log.length === 0 && (
                  <p className="text-slate-500">Waiting for activity…</p>
                )}
                {log.map((entry, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-slate-500 shrink-0 tabular-nums">
                      {entry.time.toLocaleTimeString()}
                    </span>
                    <span className={logColor[entry.type]}>
                      {entry.message}
                    </span>
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
