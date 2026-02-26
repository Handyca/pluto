import type { Area } from 'react-easy-crop';

/**
 * Reads an image from a src URL/dataURL into an HTMLImageElement.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Draws the cropped region of `imageSrc` onto a canvas and returns it as a Blob.
 * @param imageSrc  – A data URL or object URL for the source image.
 * @param pixelCrop – The pixel-level crop area returned by react-easy-crop.
 * @param mimeType  – Output format (default `image/webp`).
 * @param quality   – Output quality 0–1 (default 0.88).
 */
export async function getCroppedImageBlob(
  imageSrc: string,
  pixelCrop: Area,
  mimeType = 'image/webp',
  quality = 0.88,
): Promise<Blob> {
  const img = await loadImage(imageSrc);

  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');

  ctx.drawImage(
    img,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      mimeType,
      quality,
    );
  });
}
