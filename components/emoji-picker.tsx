'use client';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Smile } from 'lucide-react';
import { useState } from 'react';

const EMOJI_CATEGORIES = {
  Smileys: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳'],
  Gestures: ['👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘', '👌', '🤌', '🤏', '👈', '👉', '👆', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '🤲', '🤝', '🙏'],
  Hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '💕', '💖', '💗', '💓', '💞', '💝', '💘'],
  Symbols: ['🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '⭐', '🌟', '✨', '💫', '🔥', '💯', '✅', '❌', '⚠️', '📢', '💬', '💭'],
};

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<keyof typeof EMOJI_CATEGORIES>('Smileys');

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" type="button">
          <Smile className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="end">
        <div className="space-y-2">
          <div className="flex gap-1 border-b pb-2">
            {Object.keys(EMOJI_CATEGORIES).map((category) => (
              <Button
                key={category}
                variant={activeCategory === category ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActiveCategory(category as keyof typeof EMOJI_CATEGORIES)}
                className="text-xs"
              >
                {category}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-8 gap-1 max-h-64 overflow-y-auto">
            {EMOJI_CATEGORIES[activeCategory].map((emoji, index) => (
              <button
                key={index}
                onClick={() => handleSelect(emoji)}
                className="text-2xl hover:bg-muted rounded p-1 transition"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
