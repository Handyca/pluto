"use client";

import { use, useState, useEffect, useRef } from "react";
import { useJoinSession, useSessionByCode } from "@/lib/hooks/use-sessions";
import { useRealtime } from "@/lib/hooks/use-realtime";
import { PageLoading } from "@/components/loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { EmojiPicker } from "@/components/emoji-picker";
import { PhotoUpload } from "@/components/photo-upload";
import { MessageBubble } from "@/components/message-bubble";
import { WSMessageType, Message, MessageType } from "@/types";
import { Send, Loader2, X } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { generateAnonymousId } from "@/lib/utils";
import { uploadFileDirect } from "@/lib/hooks/use-messages";

// LocalStorage keys
const STORAGE_KEY_PREFIX = "pluto_participant_";

/** Stored WITHOUT the JWT token — the token is in an httpOnly cookie and is
 * obtained by re-joining with the persisted anonymousId on page reload. */
interface StoredParticipantSession {
  participantName: string;
  anonymousId: string;
  sessionCode: string;
  expiresAt: number;
}

type LocalMessage = Message & {
  optimistic?: boolean;
  clientId?: string;
};

export default function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const [joined, setJoined] = useState(false);
  const [nickname, setNickname] = useState("");
  const [token, setToken] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [anonymousId] = useState(() => generateAnonymousId());

  const { data: sessionInfo, isLoading: loadingSession } =
    useSessionByCode(code);
  const joinMutation = useJoinSession();

  const reconcileIncomingMessage = (incoming: Message) => {
    setMessages((prev) => {
      const matchIndex = prev.findIndex(
        (msg) =>
          msg.optimistic &&
          msg.type === incoming.type &&
          msg.participantName === incoming.participantName &&
          msg.content === incoming.content &&
          (incoming.imageUrl ? msg.imageUrl === incoming.imageUrl : true) &&
          (incoming.stickerUrl ? msg.stickerUrl === incoming.stickerUrl : true),
      );

      if (matchIndex >= 0) {
        const next = [...prev];
        next[matchIndex] = incoming;
        return next;
      }

      return [...prev, incoming];
    });
  };

  // Supabase Realtime — subscribe to the session channel once we have the session ID
  const { isConnected } = useRealtime({
    sessionId: sessionInfo?.id ?? "",
    onMessage: (wsMessage) => {
      switch (wsMessage.type) {
        case WSMessageType.SESSION_JOINED:
          setMessages(wsMessage.payload.messages || []);
          break;

        case WSMessageType.NEW_MESSAGE:
          reconcileIncomingMessage(wsMessage.payload);
          break;

        case WSMessageType.MESSAGE_UPDATED:
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === wsMessage.payload.messageId
                ? { ...msg, ...wsMessage.payload }
                : msg,
            ),
          );
          break;

        case WSMessageType.MESSAGE_DELETED:
          setMessages((prev) =>
            prev.filter((msg) => msg.id !== wsMessage.payload.messageId),
          );
          break;
      }
    },
  });

  // Subscription to the Supabase channel is handled automatically by useRealtime
  // once sessionInfo?.id is available. No explicit JOIN_SESSION message is needed.

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storageKey = `${STORAGE_KEY_PREFIX}${code}`;

    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;

      const stored = JSON.parse(raw) as StoredParticipantSession;
      if (stored.sessionCode !== code) return;
      if (stored.expiresAt && Date.now() > stored.expiresAt) {
        localStorage.removeItem(storageKey);
        return;
      }

      // Re-join with the stored anonymousId to obtain a fresh token.
      // The JWT is never read from localStorage — it lives only in the
      // httpOnly cookie and in React state during the session.
      joinMutation
        .mutateAsync({
          code,
          participantName: stored.participantName,
          anonymousId: stored.anonymousId,
        })
        .then((result) => {
          if (result) {
            setToken(result.token);
            setParticipantName(stored.participantName);
            setNickname(stored.participantName);
            setJoined(true);
          }
        })
        .catch(() => {
          localStorage.removeItem(storageKey);
        });
    } catch {
      localStorage.removeItem(storageKey);
    }
    // joinMutation.mutateAsync is a stable reference from TanStack Query
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  /** Send a message to the server via HTTP POST /api/messages.
   *  The participant_token cookie (httpOnly) is sent automatically. */
  const postMessage = async (payload: {
    type: MessageType;
    content: string;
    imageUrl?: string;
    stickerUrl?: string;
  }) => {
    if (!sessionInfo?.id) return;
    await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sessionInfo.id,
        participantName,
        type: payload.type,
        content: payload.content,
        ...(payload.imageUrl && { imageUrl: payload.imageUrl }),
        ...(payload.stickerUrl && { stickerUrl: payload.stickerUrl }),
      }),
    });
  };

  const addOptimisticMessage = (payload: {
    type: MessageType;
    content: string;
    imageUrl?: string;
    stickerUrl?: string;
  }) => {
    if (!sessionInfo?.id || !participantName) return;

    const clientId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    const optimisticMessage: LocalMessage = {
      id: `optimistic-${clientId}`,
      sessionId: sessionInfo.id,
      participantName,
      participantId: null,
      type: payload.type,
      content: payload.content,
      imageUrl: payload.imageUrl ?? null,
      stickerUrl: payload.stickerUrl ?? null,
      isVisible: true,
      isPinned: false,
      createdAt: new Date(),
      optimistic: true,
      clientId,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
  };

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
      if (typeof window !== "undefined") {
        const storageKey = `${STORAGE_KEY_PREFIX}${code}`;
        const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
        // Do NOT store the JWT token — it's already in the httpOnly cookie.
        // Only non-sensitive identifiers are persisted so we can auto-rejoin.
        const stored: StoredParticipantSession = {
          participantName: nickname,
          anonymousId,
          sessionCode: code,
          expiresAt,
        };
        localStorage.setItem(storageKey, JSON.stringify(stored));
      }
      toast.success("Joined successfully!");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || isSending || !sessionInfo?.id) return;

    setIsSending(true);
    try {
      addOptimisticMessage({
        type: MessageType.TEXT,
        content: messageInput.trim(),
      });
      await postMessage({
        type: MessageType.TEXT,
        content: messageInput.trim(),
      });

      setMessageInput("");
    } catch {
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessageInput((prev) => prev + emoji);
  };

  const handlePhotoSelect = (file: File, preview: string) => {
    setSelectedPhotoFile(file);
    setPhotoPreview(preview);
  };

  const handleSendPhoto = async () => {
    if (!selectedPhotoFile || isSending || !sessionInfo?.id) return;

    setIsSending(true);
    try {
      // Upload directly to Supabase Storage (bypasses Vercel function body limit)
      const uploaded = await uploadFileDirect(
        selectedPhotoFile,
        "image",
        token ?? undefined,
      );

      addOptimisticMessage({
        type: MessageType.IMAGE,
        content: messageInput.trim(),
        imageUrl: uploaded.url,
      });

      await postMessage({
        type: MessageType.IMAGE,
        content: messageInput.trim(),
        imageUrl: uploaded.url,
      });

      setMessageInput("");
      setPhotoPreview(null);
      setSelectedPhotoFile(null);
      toast.success("Photo sent!");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to upload photo";
      toast.error(message);
    } finally {
      setIsSending(false);
    }
  };

  const clearPhotoPreview = () => {
    setPhotoPreview(null);
    setSelectedPhotoFile(null);
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
              The session code &quot;{code}&quot; does not exist or is no longer
              active.
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
              This session is currently not active. Please check with the
              organizer.
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
                  "Join Session"
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
            <div
              className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
            />
            <span className="text-sm text-muted-foreground">
              {isConnected ? "Connected" : "Disconnected"}
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
          {/* Photo Preview */}
          {photoPreview && (
            <div className="mb-4 relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoPreview}
                alt="preview"
                className="max-w-xs max-h-48 rounded-lg border"
              />
              <button
                onClick={clearPhotoPreview}
                className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1 hover:bg-destructive/90"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <form
            onSubmit={
              photoPreview
                ? (e) => {
                    e.preventDefault();
                    handleSendPhoto();
                  }
                : handleSendMessage
            }
          >
            <div className="border rounded-xl bg-background focus-within:ring-2 focus-within:ring-ring/20 transition-shadow">
              {/* Textarea row */}
              <div className="flex items-end gap-2 px-3 pt-2">
                <Textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder={
                    photoPreview
                      ? "Add a caption to your photo (optional)"
                      : "Type your message..."
                  }
                  className="flex-1 min-w-0 resize-none min-h-[44px] max-h-32 border-0 shadow-none focus-visible:ring-0 bg-transparent p-0 break-words overflow-hidden"
                  maxLength={1000}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (photoPreview) {
                        handleSendPhoto();
                      } else {
                        handleSendMessage(e);
                      }
                    }
                  }}
                />
                <Button
                  type="submit"
                  size="icon"
                  className="flex-shrink-0 mb-1"
                  disabled={
                    photoPreview ? isSending : !messageInput.trim() || isSending
                  }
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {/* Action bar */}
              <div className="flex items-center gap-1 px-2 pb-2">
                <EmojiPicker onSelect={handleEmojiSelect} />
                <PhotoUpload
                  onPhotoSelect={handlePhotoSelect}
                  isLoading={isSending}
                />
                <span className="ml-auto text-xs text-muted-foreground pr-1 shrink-0">
                  {messageInput.length}/1000
                </span>
              </div>
            </div>
          </form>
          <p className="text-xs text-muted-foreground mt-1.5">
            Press Enter to send • Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
