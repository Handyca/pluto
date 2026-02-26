'use client';

import { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { getCroppedImageBlob } from '@/lib/utils/crop-image';

interface ImageCropDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Data URL or object URL of the image to crop. */
  imageSrc: string;
  /** Crop aspect ratio. Defaults to 16/9 (presenter stage). */
  aspect?: number;
  /** Called with the resulting Blob and a fresh preview URL when the user confirms. */
  onConfirm: (blob: Blob, previewUrl: string) => void;
  /** Called when the dialog is dismissed without confirming. */
  onClose: () => void;
}

export function ImageCropDialog({
  open,
  imageSrc,
  aspect = 16 / 9,
  onConfirm,
  onClose,
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  };

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setIsProcessing(true);
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels, rotation);
      const previewUrl = URL.createObjectURL(blob);
      onConfirm(blob, previewUrl);
    } catch (err) {
      console.error('Crop failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl w-full p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle>Adjust Image</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Drag to reposition · scroll or use the slider to zoom
          </p>
        </DialogHeader>

        {/* Crop canvas — fixed 16:9 container */}
        <div
          className="relative w-full bg-black"
          style={{ aspectRatio: '16/9' }}
        >
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            showGrid
            style={{
              containerStyle: { background: '#000' },
              cropAreaStyle: { border: '2px solid rgba(255,255,255,0.8)' },
            }}
          />
        </div>

        {/* Controls */}
        <div className="px-6 py-4 space-y-4">
          {/* Zoom */}
          <div className="flex items-center gap-3">
            <ZoomOut className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <Label className="sr-only">Zoom</Label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-2 accent-primary cursor-pointer"
              />
            </div>
            <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">
              {(zoom * 100).toFixed(0)}%
            </span>
          </div>

          {/* Rotation */}
          <div className="flex items-center gap-3">
            <RotateCcw className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <Label className="sr-only">Rotation</Label>
              <input
                type="range"
                min={-180}
                max={180}
                step={1}
                value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                className="w-full h-2 accent-primary cursor-pointer"
              />
            </div>
            <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">
              {rotation}°
            </span>
          </div>
        </div>

        <DialogFooter className="px-6 pb-5 gap-2">
          <Button variant="ghost" onClick={handleReset} type="button">
            Reset
          </Button>
          <Button variant="outline" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isProcessing} type="button">
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing…
              </>
            ) : (
              'Apply'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
