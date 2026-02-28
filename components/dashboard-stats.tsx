"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  MessageSquare,
  Wifi,
  WifiOff,
  Activity,
  TrendingUp,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

interface DashboardStats {
  activeSessions: number;
  totalParticipants: number;
  totalMessages: number;
  uptime: string;
}

export function DashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [latency, setLatency] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const connectTime = useState(() => Date.now())[0];

  // Subscribe to a lightweight "dashboard" channel purely to measure
  // Supabase Realtime connectivity and connection latency.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const supabase = getSupabaseBrowserClient();
    const t0 = connectTime;
    const channel = supabase.channel("dashboard").subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setIsConnected(true);
        setLatency(Math.max(1, Date.now() - t0));
      } else if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        setIsConnected(false);
      }
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [connectTime]);

  // Fetch stats separately
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/admin/stats");
        if (!res.ok) {
          console.error(`Failed to fetch stats: HTTP ${res.status}`);
          let errorMessage = "";
          try {
            const error = await res.json();
            errorMessage = error.error || error.message || "";
          } catch {}
          console.error(`Error: ${errorMessage || res.statusText}`);
          return;
        }
        const data = await res.json();
        if (data.success && data.data) {
          setStats(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000); // Update every 10s

    return () => clearInterval(interval);
  }, []); // Empty dependency array - only run once on mount

  const statCards = [
    {
      title: "Active Sessions",
      value: stats?.activeSessions || 0,
      icon: Users,
      color: "text-blue-400",
    },
    {
      title: "Participants",
      value: stats?.totalParticipants || 0,
      icon: Users,
      color: "text-purple-400",
    },
    {
      title: "Messages",
      value: stats?.totalMessages || 0,
      icon: MessageSquare,
      color: "text-green-400",
    },
    {
      title: "Latency",
      value: `${latency}ms`,
      icon: Activity,
      color: "text-orange-400",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className="flex items-center gap-4 rounded-lg bg-card p-4 border">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <Wifi className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium">
                Supabase Realtime Connected
              </span>
              <Badge className="bg-green-500/20 text-green-300">Live</Badge>
            </>
          ) : (
            <>
              <WifiOff className="h-5 w-5 text-red-500" />
              <span className="text-sm font-medium">
                Supabase Realtime Disconnected
              </span>
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
