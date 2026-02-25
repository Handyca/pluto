import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Build a WebSocket URL that connects back to the same server the page was
// loaded from (same host AND port), so it works through any proxy, tunnel or
// VS Code dev-container port-forwarding without needing a second open port.
export function getWsUrl(): string {
  if (typeof window === 'undefined') {
    const port = process.env.PORT || '3000';
    return `ws://localhost:${port}/ws`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}/ws`;
}

// Generate a unique anonymous ID (UUID v4)
export function generateAnonymousId(): string {
  return crypto.randomUUID();
}

// Generate a random 6-character session code
export function generateSessionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar looking chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Get initials from a name (up to 2 characters)
export function getInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Generate a consistent colour for an avatar based on the name.
// Returns a hex colour string suitable for use as a CSS value (e.g. style={{ backgroundColor }}).
export function generateAvatarColor(name: string): string {
  const colors = [
    '#3b82f6', // blue-500
    '#a855f7', // purple-500
    '#22c55e', // green-500
    '#eab308', // yellow-500
    '#ec4899', // pink-500
    '#6366f1', // indigo-500
    '#ef4444', // red-500
    '#f97316', // orange-500
    '#14b8a6', // teal-500
    '#06b6d4', // cyan-500
  ];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

// Extension-to-MIME mapping for fallback when file.type is empty (e.g. drag-and-drop)
const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', avif: 'image/avif',
  bmp: 'image/bmp', tiff: 'image/tiff', tif: 'image/tiff', svg: 'image/svg+xml',
  jfif: 'image/jpeg', pjpeg: 'image/jpeg', pjp: 'image/jpeg',
  mp4: 'video/mp4', webm: 'video/webm', ogg: 'video/ogg',
  mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska',
};

export function resolveFileMime(file: File): string {
  if (file.type) return file.type.toLowerCase();
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXT_TO_MIME[ext] ?? '';
}

// Validate image MIME types
export function isValidImageType(mimeType: string): boolean {
  const validTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'image/heic', 'image/heif', 'image/avif', 'image/bmp',
    'image/tiff', 'image/svg+xml', 'image/jfif',
  ];
  return validTypes.includes(mimeType.toLowerCase());
}

// Validate video MIME types
export function isValidVideoType(mimeType: string): boolean {
  const validTypes = [
    'video/mp4', 'video/webm', 'video/ogg',
    'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
  ];
  return validTypes.includes(mimeType.toLowerCase());
}
