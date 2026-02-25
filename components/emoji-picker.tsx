'use client';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Smile } from 'lucide-react';
import { useState } from 'react';
import EmojiPickerLibrary, { Theme } from 'emoji-picker-react';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (emojiData: any) => {
    onSelect(emojiData.emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" type="button" title="Add emoji">
          <Smile className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-fit p-0" align="end">
        <EmojiPickerLibrary 
          onEmojiClick={handleSelect}
          theme={Theme.DARK}
          height={400}
          width={350}
          previewConfig={{ showPreview: false }}
          searchPlaceHolder="Search emojis..."
        />
      </PopoverContent>
    </Popover>
  );
}
