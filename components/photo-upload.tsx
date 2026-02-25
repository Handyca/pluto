'use client';

import { Button } from '@/components/ui/button';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

interface PhotoUploadProps {
  onPhotoSelect: (file: File, preview: string) => void;
  isLoading?: boolean;
}

export function PhotoUpload({ onPhotoSelect, isLoading = false }: PhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localLoading, setLocalLoading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 30MB)
    const maxSizeMB = 30;
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`Image size must be less than ${maxSizeMB}MB`);
      return;
    }

    setLocalLoading(true);
    try {
      // Create preview
      const reader = new FileReader();
      reader.onload = (event) => {
        const preview = event.target?.result as string;
        onPhotoSelect(file, preview);
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error('Failed to read file');
    } finally {
      setLocalLoading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={isLoading || localLoading}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleClick}
        disabled={isLoading || localLoading}
        title="Add photo from album"
      >
        {localLoading || isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ImageIcon className="h-5 w-5" />
        )}
      </Button>
    </>
  );
}
