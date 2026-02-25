'use client';

import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageLoading } from '@/components/loading';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Users, MessageSquare, Search, RefreshCw, Circle } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';
import { generateAvatarColor, getInitials } from '@/lib/utils';

interface Participant {
  id: string;
  nickname: string;
  anonymousId: string;
  joinedAt: string;
  lastSeenAt: string;
  _count: { messages: number };
}

interface SessionInfo {
  title: string;
  code: string;
  isActive: boolean;
}

// A participant is considered online if their lastSeenAt is within 5 minutes.
function isOnline(lastSeenAt: string): boolean {
  return differenceInMinutes(new Date(), new Date(lastSeenAt)) < 5;
}

export default function ParticipantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['participants', id],
    queryFn: async () => {
      const res = await fetch(`/api/sessions/${id}/participants`);
      const body = await res.json();
      if (!body.success) throw new Error(body.error);
      return body.data as { session: SessionInfo; participants: Participant[] };
    },
    refetchInterval: 30_000, // auto-refresh every 30 s
  });

  if (isLoading || !data) return <PageLoading />;

  const { session, participants } = data;
  const filtered = participants.filter((p) =>
    p.nickname.toLowerCase().includes(search.toLowerCase())
  );
  const onlineCount = participants.filter((p) => isOnline(p.lastSeenAt)).length;
  const totalMessages = participants.reduce((sum, p) => sum + p._count.messages, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href={`/admin/sessions/${id}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Participants</h1>
              <p className="text-sm text-muted-foreground">{session.title}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Badge variant={session.isActive ? 'default' : 'secondary'}>
                {session.isActive ? 'Active' : 'Inactive'}
              </Badge>
              <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                {session.code}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => refetch()}
                disabled={isFetching}
                title="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{participants.length}</p>
                <p className="text-sm text-muted-foreground">Total Joined</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <Circle className="h-6 w-6 text-green-500 fill-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{onlineCount}</p>
                <p className="text-sm text-muted-foreground">Online Now</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalMessages}</p>
                <p className="text-sm text-muted-foreground">Total Messages</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and table */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <CardTitle>All Participants</CardTitle>
              <div className="ml-auto relative w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                {search ? 'No participants match your search.' : 'No participants have joined yet.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
                      <th className="px-6 py-3 text-left font-medium">Participant</th>
                      <th className="px-6 py-3 text-left font-medium">Status</th>
                      <th className="px-6 py-3 text-left font-medium">Joined</th>
                      <th className="px-6 py-3 text-left font-medium">Last Seen</th>
                      <th className="px-6 py-3 text-right font-medium">Messages</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map((p) => {
                      const online = isOnline(p.lastSeenAt);
                      const color = generateAvatarColor(p.nickname);
                      const initials = getInitials(p.nickname);
                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          {/* Participant */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback
                                  style={{ backgroundColor: color }}
                                  className="text-white text-xs font-semibold"
                                >
                                  {initials}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{p.nickname}</p>
                                <p className="text-xs text-muted-foreground font-mono truncate max-w-[140px]">
                                  {p.anonymousId.slice(0, 8)}…
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5">
                              <div
                                className={`h-2 w-2 rounded-full ${
                                  online ? 'bg-green-500' : 'bg-gray-300'
                                }`}
                              />
                              <span className={`text-xs ${online ? 'text-green-600' : 'text-muted-foreground'}`}>
                                {online ? 'Online' : 'Offline'}
                              </span>
                            </div>
                          </td>

                          {/* Joined */}
                          <td className="px-6 py-4 text-muted-foreground">
                            <span title={new Date(p.joinedAt).toLocaleString()}>
                              {formatDistanceToNow(new Date(p.joinedAt), { addSuffix: true })}
                            </span>
                          </td>

                          {/* Last seen */}
                          <td className="px-6 py-4 text-muted-foreground">
                            <span title={new Date(p.lastSeenAt).toLocaleString()}>
                              {formatDistanceToNow(new Date(p.lastSeenAt), { addSuffix: true })}
                            </span>
                          </td>

                          {/* Messages */}
                          <td className="px-6 py-4 text-right">
                            <Badge variant={p._count.messages > 0 ? 'default' : 'secondary'}>
                              {p._count.messages}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
