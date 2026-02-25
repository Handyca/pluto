'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { useSessions, useCreateSession, useDeleteSession } from '@/lib/hooks/use-sessions';
import { AdminLayout } from '@/components/admin-layout';
import { DashboardStats } from '@/components/dashboard-stats';
import { PageLoading } from '@/components/loading';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Plus, 
  Settings, 
  Trash2, 
  Users, 
  Users2,
  MessageSquare, 
  Copy,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export default function AdminDashboard() {
  const { data: sessions, isLoading } = useSessions();
  const createMutation = useCreateSession();
  const deleteMutation = useDeleteSession();

  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionTitle.trim()) return;

    try {
      await createMutation.mutateAsync({ title: newSessionTitle });
      setNewSessionTitle('');
      setIsCreateDialogOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create session';
      if (message.includes('sign in')) {
        await signOut({ callbackUrl: '/admin/login' });
      }
    }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
    } catch {
      // error already toasted by onError
    }
    setDeleteConfirm(null);
  };

  const copyJoinUrl = (code: string) => {
    const url = `${window.location.origin}/join/${code}`;
    navigator.clipboard.writeText(url);
    toast.success('Join URL copied to clipboard');
  };

  const copyPresenterUrl = (code: string) => {
    const url = `${window.location.origin}/presenter/${code}`;
    navigator.clipboard.writeText(url);
    toast.success('Presenter URL copied to clipboard');
  };

  if (isLoading) {
    return <PageLoading />;
  }

  return (
    <AdminLayout sessionCount={sessions?.length}>
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="border-b bg-card sticky top-0 z-50">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <p className="text-muted-foreground mt-1">Manage your presentation sessions and system</p>
              </div>
              <Link href="/admin/users">
                <Button variant="outline" className="gap-2">
                  <Users2 className="h-4 w-4" />
                  Manage Admins
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-4 py-8 space-y-8">
          {/* Stats */}
          <DashboardStats />

          <Tabs defaultValue="sessions" className="space-y-4">
            <TabsList>
              <TabsTrigger value="sessions">Sessions</TabsTrigger>
            </TabsList>

            <TabsContent value="sessions" className="space-y-4">

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Session
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Session</DialogTitle>
                <DialogDescription>
                  Create a new presentation session for real-time chat
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateSession} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Session Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Q&A Session, Team Meeting"
                    value={newSessionTitle}
                    onChange={(e) => setNewSessionTitle(e.target.value)}
                    maxLength={100}
                    required
                    autoFocus
                  />
                </div>
                <DialogFooter>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || !newSessionTitle.trim()}
                  >
                    Create Session
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Sessions Grid */}
          {sessions && sessions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((session) => (
              <Card key={session.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{session.title}</CardTitle>
                      <CardDescription className="mt-1">
                        Code: <code className="font-mono font-bold">{session.code}</code>
                      </CardDescription>
                    </div>
                    <Badge variant={session.isActive ? 'default' : 'secondary'}>
                      {session.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{session._count?.participants || 0} participants</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MessageSquare className="h-4 w-4" />
                      <span>{session._count?.messages || 0} messages</span>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Created {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => copyJoinUrl(session.code)}>
                      <Copy className="h-3 w-3 mr-1" />
                      Join URL
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => copyPresenterUrl(session.code)}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Presenter
                    </Button>
                    <Link href={`/presenter/${session.code}`} target="_blank">
                      <Button variant="outline" size="sm">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Open
                      </Button>
                    </Link>
                  </div>

                  <div className="flex gap-2 pt-2 border-t">
                    <Link href={`/admin/sessions/${session.id}`} className="flex-1">
                      <Button variant="secondary" size="sm" className="w-full">
                        <Settings className="h-3 w-3 mr-1" />
                        Manage
                      </Button>
                    </Link>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => setDeleteConfirm(session.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
              <MessageSquare className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <p className="text-lg font-medium">No sessions yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create your first session to get started
                </p>
              </div>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Session
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Session</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this session? This action cannot be undone.
                All messages and participants will be permanently deleted.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => deleteConfirm && handleDeleteSession(deleteConfirm)}
                disabled={deleteMutation.isPending}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AdminLayout>
  );
}

