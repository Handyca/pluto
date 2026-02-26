"use client";

import { useEffect, useState } from "react";
import { Message, MessageType } from "@/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getInitials, generateAvatarColor } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Pin, EyeOff, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { createPortal } from "react-dom";

interface MessageBubbleProps {
  message: Message;
  showActions?: boolean;
  onToggleVisibility?: (id: string, isVisible: boolean) => void;
  onTogglePin?: (id: string, isPinned: boolean) => void;
  onDelete?: (id: string) => void;
}

export function MessageBubble({
  message,
  showActions = false,
  onToggleVisibility,
  onTogglePin,
  onDelete,
}: MessageBubbleProps) {
  const avatarColor = generateAvatarColor(message.participantName);
  const initials = getInitials(message.participantName);

  // Image lightbox state
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Refresh timestamp display every minute so "X minutes ago" stays accurate.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const renderContent = () => {
    switch (message.type) {
      case MessageType.TEXT:
        return (
          <p className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] opacity-90 min-w-0">
            {message.content}
          </p>
        );

      case MessageType.IMAGE:
        return (
          <div className="space-y-2 min-w-0">
            {message.content && (
              <p className="text-sm break-words [overflow-wrap:anywhere] opacity-90">
                {message.content}
              </p>
            )}
            {message.imageUrl && (
              <div
                className="relative w-full max-w-xs h-48 rounded-lg overflow-hidden cursor-zoom-in"
                onClick={() => setLightboxUrl(message.imageUrl!)}
              >
                <Image
                  src={message.imageUrl}
                  alt="Shared image"
                  fill
                  className="object-cover hover:scale-105 transition-transform"
                />
              </div>
            )}
          </div>
        );

      case MessageType.STICKER:
        return (
          <div className="space-y-2 min-w-0">
            {message.content && (
              <p className="text-sm break-words [overflow-wrap:anywhere] opacity-90">
                {message.content}
              </p>
            )}
            {message.stickerUrl && (
              <Image
                src={message.stickerUrl}
                alt="Sticker"
                width={120}
                height={120}
                className="object-contain"
              />
            )}
          </div>
        );

      case MessageType.EMOJI:
        return <p className="text-4xl">{message.content}</p>;

      default:
        return (
          <p className="text-sm break-words [overflow-wrap:anywhere] opacity-90">
            {message.content}
          </p>
        );
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2 }}
        className={`flex gap-3 p-3 rounded-lg transition-colors ${message.isPinned ? "border border-white/20 bg-white/5" : ""}`}
        style={{ color: "inherit" }}
      >
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback
            style={{ backgroundColor: avatarColor }}
            className="text-white text-xs"
          >
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="font-semibold text-sm"
              style={{ color: "inherit" }}
            >
              {message.participantName}
            </span>
            <span className="text-xs opacity-55">
              {formatDistanceToNow(new Date(message.createdAt), {
                addSuffix: true,
              })}
            </span>
            {message.isPinned && (
              <Badge variant="secondary" className="text-xs">
                <Pin className="h-3 w-3 mr-1" />
                Pinned
              </Badge>
            )}
            {!message.isVisible && (
              <Badge variant="outline" className="text-xs">
                <EyeOff className="h-3 w-3 mr-1" />
                Hidden
              </Badge>
            )}
          </div>

          <div style={{ color: "inherit" }}>{renderContent()}</div>

          {showActions && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={() =>
                  onToggleVisibility?.(message.id, !message.isVisible)
                }
                className="text-xs text-gray-500 hover:text-gray-300 transition"
              >
                {message.isVisible ? "Hide" : "Show"}
              </button>
              <button
                onClick={() => onTogglePin?.(message.id, !message.isPinned)}
                className="text-xs text-gray-500 hover:text-gray-300 transition"
              >
                {message.isPinned ? "Unpin" : "Pin"}
              </button>
              <button
                onClick={() => onDelete?.(message.id)}
                className="text-xs text-red-400 hover:text-red-300 transition"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Image lightbox — true fullscreen portal */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {lightboxUrl && (
              <motion.div
                key="lightbox"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-[9999] bg-black flex items-center justify-center"
                onClick={() => setLightboxUrl(null)}
              >
                {/* Close button */}
                <button
                  className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/25 transition-colors text-white"
                  onClick={() => setLightboxUrl(null)}
                  aria-label="Close"
                >
                  <X className="h-6 w-6" />
                </button>
                {/* Image — stop propagation so clicking the image itself doesn't close */}
                <div
                  className="relative w-full h-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Image
                    src={lightboxUrl}
                    alt="Full size image"
                    fill
                    className="object-contain"
                    sizes="100vw"
                    priority
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
