'use client';

import { use, useState, useEffect, useRef } from 'react';
import { useJoinSession, useSessionByCode } from '@/lib/hooks/use-sessions';
import { useWebSocket } from '@/lib/hooks/use-websocket';
import { PageLoading } from '@/components/loading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { EmojiPicker } from '@/components/emoji-picker';
import { MessageBubble } from '@/components/message-bubble';
import { WSMessageType, Message, MessageType } from '@/types';
import { Send, Image as ImageIcon, Loader2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { generateAnonymousId, getWsUrl } from '@/lib/utils';

export default function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const [joined, setJoined] = useState(false);
  const [nickname, setNickname] = useState('');
  const [token, setToken] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [anonymousId] = useState(() => generateAnonymousId());

  const { data: sessionInfo, isLoading: loadingSession } = useSessionByCode(code);
  const joinMutation = useJoinSession();

  // WebSocket connection
  const [wsUrl] = useState(() => getWsUrl());
  const { sendMessage: sendWsMessage, isConnected } = useWebSocket({
    url: wsUrl,
    onMessage: (wsMessage) => {
      switch (wsMessage.type) {
        case WSMessageType.SESSION_JOINED:
          setMessages(wsMessage.payload.messages || []);
          break;

        case WSMessageType.NEW_MESSAGE:
          setMessages((prev) => [...prev, wsMessage.payload]);
          break;

        case WSMessageType.MESSAGE_UPDATED:
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === wsMessage.payload.messageId
                ? { ...msg, ...wsMessage.payload }
                : msg
            )
          );
          break;

        case WSMessageType.MESSAGE_DELETED:
          setMessages((prev) =>
            prev.filter((msg) => msg.id !== wsMessage.payload.messageId)
          );
          break;
      }
    },
  });

  // Join session via WebSocket when connected
  useEffect(() => {
    if (isConnected && joined && token) {
      sendWsMessage({
        type: WSMessageType.JOIN_SESSION,
        payload: {
          sessionCode: code,
          token,
          isAdmin: false,
        },
      });
    }
  }, [isConnected, joined, token, code, sendWsMessage]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;

    const result = await joinMutation.mutateAsync({
      code,
      participantName: nickname,
      anonymousId,
    });

    if (result) {
      setToken(result.token);
      setParticipantName(nickname);
      setJoined(true);
      toast.success('Joined successfully!');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || isSending) return;

    setIsSending(true);
    try {
      sendWsMessage({
        type: WSMessageType.SEND_MESSAGE,
        payload: {
          sessionId: sessionInfo?.id,
          participantName,
          type: MessageType.TEXT,
          content: messageInput.trim(),
        },
      });

      setMessageInput('');
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessageInput((prev) => prev + emoji);
  };

  const handleSendEmoji = (emoji: string) => {
    sendWsMessage({
      type: WSMessageType.SEND_MESSAGE,
      payload: {
        sessionId: sessionInfo?.id,
        participantName,
        type: MessageType.EMOJI,
        content: emoji,
      },
    });
  };

  if (loadingSession) {
    return <PageLoading />;
  }

  if (!sessionInfo) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardHeader>
            <CardTitle>Session Not Found</CardTitle>
            <CardDescription>
              The session code &quot;{code}&quot; does not exist or is no longer active.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!sessionInfo.isActive) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardHeader>
            <CardTitle>Session Inactive</CardTitle>
            <CardDescription>
              This session is currently not active. Please check with the organizer.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Join form
  if (!joined) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{sessionInfo.title}</CardTitle>
            <CardDescription>
              Enter your name to join the conversation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nickname">Your Name</Label>
                <Input
                  id="nickname"
                  type="text"
                  placeholder="Enter your name"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={50}
                  required
                  autoFocus
                />
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={joinMutation.isPending || !nickname.trim()}
              >
                {joinMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Joining...
                  </>
                ) : (
                  'Join Session'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Chat interface
  const visibleMessages = messages.filter((msg) => msg.isVisible);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{sessionInfo.title}</h1>
            <p className="text-sm text-muted-foreground">
              Joined as {participantName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-muted-foreground">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-3">
          <AnimatePresence mode="popLayout">
            {visibleMessages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </AnimatePresence>

          {visibleMessages.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              <p>No messages yet</p>
              <p className="text-sm mt-2">Be the first to send a message!</p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t bg-card p-4">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <div className="flex-1 flex gap-2">
              <Textarea
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Type your message..."
                className="resize-none min-h-[60px]"
                maxLength={1000}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <EmojiPicker onSelect={handleEmojiSelect} />
              <Button 
                type="submit" 
                size="icon"
                disabled={!messageInput.trim() || isSending}
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>
          <p className="text-xs text-muted-foreground mt-2">
            {messageInput.length}/1000 characters • Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
