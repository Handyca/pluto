'use client';

import { Message, MessageType } from '@/types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { getInitials, generateAvatarColor } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Pin, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import Image from 'next/image';

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

  const renderContent = () => {
    switch (message.type) {
      case MessageType.TEXT:
        return <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>;
      
      case MessageType.IMAGE:
        return (
          <div className="space-y-2">
            {message.content && <p className="text-sm">{message.content}</p>}
            {message.imageUrl && (
              <div className="relative w-64 h-48 rounded-lg overflow-hidden">
                <Image 
                  src={message.imageUrl} 
                  alt="Shared image" 
                  fill
                  className="object-cover"
                />
              </div>
            )}
          </div>
        );
      
      case MessageType.STICKER:
        return (
          <div className="space-y-2">
            {message.content && <p className="text-sm">{message.content}</p>}
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
        return (
          <p className="text-4xl">
            {message.content}
          </p>
        );
      
      default:
        return <p className="text-sm">{message.content}</p>;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-3 p-3 rounded-lg transition-colors ${
        !message.isVisible ? 'opacity-50 bg-muted/50' : 'hover:bg-muted/30'
      } ${message.isPinned ? 'bg-primary/5 border border-primary/20' : ''}`}
    >
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback style={{ backgroundColor: avatarColor }} className="text-white text-xs">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{message.participantName}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
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

        <div className="text-foreground">
          {renderContent()}
        </div>

        {showActions && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => onToggleVisibility?.(message.id, !message.isVisible)}
              className="text-xs text-muted-foreground hover:text-foreground transition"
            >
              {message.isVisible ? 'Hide' : 'Show'}
            </button>
            <button
              onClick={() => onTogglePin?.(message.id, !message.isPinned)}
              className="text-xs text-muted-foreground hover:text-foreground transition"
            >
              {message.isPinned ? 'Unpin' : 'Pin'}
            </button>
            <button
              onClick={() => onDelete?.(message.id)}
              className="text-xs text-destructive hover:text-destructive/80 transition"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
