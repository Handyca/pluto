'use client';

import { useRef, useEffect } from 'react';

interface VideoBackgroundProps {
  src: string;
  muted?: boolean;
  loop?: boolean;
  className?: string;
}

export function VideoBackground({ 
  src, 
  muted = true, 
  loop = true,
  className = ''
}: VideoBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(error => {
        console.warn('Video autoplay failed:', error);
      });
    }
  }, [src]);

  return (
    <video
      ref={videoRef}
      src={src}
      muted={muted}
      loop={loop}
      playsInline
      autoPlay
      className={`absolute inset-0 w-full h-full object-cover ${className}`}
    />
  );
}
