'use client';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

const DEFAULT_STICKERS = [
  '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉',
  '👍', '👏', '🙌', '💪', '✨', '⭐', '🌟', '💫',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '💖', '💝',
  '😂', '🤣', '😍', '😎', '🥳', '🤩', '😍', '🥰',
  '🚀', '💥', '🔥', '💯', '⚡', '🌈', '🦄', '🎯',
];

interface StickerPickerProps {
  onSelect: (sticker: string, stickerUrl?: string) => void;
}

interface StickerItem {
  url?: string;
  filename?: string;
}

export function StickerPicker({ onSelect }: StickerPickerProps) {
  const [open, setOpen] = useState(false);

  // Fetch uploaded stickers from server
  const { data: stickers } = useQuery({
    queryKey: ['stickers'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/upload?type=STICKER');
        if (!response.ok) return DEFAULT_STICKERS;
        const data = await response.json();
        return data.data || DEFAULT_STICKERS;
      } catch {
        return DEFAULT_STICKERS;
      }
    },
  });

  const handleSelect = (sticker: any) => {
    if (typeof sticker === 'string') {
      // Emoji sticker
      onSelect(sticker);
    } else {
      // Image sticker
      onSelect(sticker.filename || sticker.url, sticker.url);
    }
    setOpen(false);
  };

  const stickerList = (stickers || DEFAULT_STICKERS) as (string | StickerItem)[];
  const isEmoji = typeof stickerList[0] === 'string';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" type="button" title="Add sticker">
          <Sparkles className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end">
        <div className="space-y-2">
          <h3 className="font-semibold text-sm">Stickers</h3>
          <div className="grid grid-cols-6 gap-2 max-h-64 overflow-y-auto">
            {stickerList.map((sticker: any, index: number) => (
              isEmoji ? (
                <button
                  key={index}
                  onClick={() => handleSelect(sticker)}
                  className="text-3xl hover:bg-muted rounded p-2 transition transform hover:scale-110"
                >
                  {sticker as string}
                </button>
              ) : (
                <button
                  key={index}
                  onClick={() => handleSelect(sticker)}
                  className="w-12 h-12 hover:bg-muted rounded p-1 transition transform hover:scale-110"
                  title={(sticker as StickerItem).filename}
                >
                  <img
                    src={(sticker as StickerItem).url || ''}
                    alt="sticker"
                    className="w-full h-full object-contain"
                  />
                </button>
              )
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
