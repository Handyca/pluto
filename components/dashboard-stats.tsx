'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  MessageSquare,
  Wifi,
  WifiOff,
  Activity,
  TrendingUp,
} from 'lucide-react';

interface DashboardStats {
  activeSessions: number;
  totalParticipants: number;
  totalMessages: number;
  uptime: string;
}

interface WSStatus {
  connected: boolean;
  latency: number;
}

export function DashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [wsStatus, setWsStatus] = useState<WSStatus>({
    connected: false,
    latency: 0,
  });
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  // Establish WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      if (typeof window === 'undefined') return;

      try {
        const wsProto =
          window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProto}//${window.location.host}/ws`;

        if (wsRef.current?.readyState === WebSocket.OPEN) {
          return; // Already connected
        }

        const startTime = Date.now();
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('✅ WebSocket connected');
          setWsStatus({
            connected: true,
            latency: Math.max(1, Date.now() - startTime),
          });
          reconnectAttemptsRef.current = 0;
        };

        ws.onerror = () => {
          console.warn(`⚠️ WebSocket error: ${wsUrl}`);
          setWsStatus((prev) => ({ ...prev, connected: false }));
        };

        ws.onclose = () => {
          console.log('📴 WebSocket disconnected');
          setWsStatus((prev) => ({ ...prev, connected: false }));
          wsRef.current = null;

          // Auto-reconnect with exponential backoff
          if (
            reconnectAttemptsRef.current < maxReconnectAttempts
          ) {
            reconnectAttemptsRef.current++;
            const delay = Math.min(
              10000,
              1000 * Math.pow(2, reconnectAttemptsRef.current - 1)
            );
            console.log(
              `🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
            );
            reconnectTimeoutRef.current = setTimeout(
              connectWebSocket,
              delay
            );
          } else {
            console.error(
              `❌ WebSocket: gave up after ${maxReconnectAttempts} attempts`
            );
          }
        };

        wsRef.current = ws;
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        setWsStatus((prev) => ({ ...prev, connected: false }));
      }
    };

    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, []); // Empty dependency array - only run once on mount

  // Fetch stats separately
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/admin/stats');
        if (!res.ok) {
          console.error(`Failed to fetch stats: HTTP ${res.status}`);
          let errorMessage = '';
          try {
            const error = await res.json();
            errorMessage = error.error || error.message || '';
          } catch {}
          console.error(`Error: ${errorMessage || res.statusText}`);
          return;
        }
        const data = await res.json();
        if (data.success && data.data) {
          setStats(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000); // Update every 10s

    return () => clearInterval(interval);
  }, []); // Empty dependency array - only run once on mount

  const statCards = [
    {
      title: 'Active Sessions',
      value: stats?.activeSessions || 0,
      icon: Users,
      color: 'text-blue-400',
    },
    {
      title: 'Participants',
      value: stats?.totalParticipants || 0,
      icon: Users,
      color: 'text-purple-400',
    },
    {
      title: 'Messages',
      value: stats?.totalMessages || 0,
      icon: MessageSquare,
      color: 'text-green-400',
    },
    {
      title: 'Latency',
      value: `${wsStatus.latency}ms`,
      icon: Activity,
      color: 'text-orange-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className="flex items-center gap-4 rounded-lg bg-card p-4 border">
        <div className="flex items-center gap-2">
          {wsStatus.connected ? (
            <>
              <Wifi className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium">WebSocket Connected</span>
              <Badge className="bg-green-500/20 text-green-300">Live</Badge>
            </>
          ) : (
            <>
              <WifiOff className="h-5 w-5 text-red-500" />
              <span className="text-sm font-medium">WebSocket Disconnected</span>
              <Badge className="bg-red-500/20 text-red-300">Offline</Badge>
            </>
          )}
        </div>
        {stats?.uptime && (
          <div className="ml-auto text-xs text-muted-foreground">
            Uptime: {stats.uptime}
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <Card key={idx} className="bg-card/50">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    {stat.title}
                  </CardTitle>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  <TrendingUp className="h-3 w-3 inline mr-1" />
                  Updated in real-time
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
