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

// Generate a consistent color for an avatar based on the name
export function generateAvatarColor(name: string): string {
  const colors = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-red-500',
    'bg-orange-500',
    'bg-teal-500',
    'bg-cyan-500',
  ];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

// Validate image MIME types
export function isValidImageType(mimeType: string): boolean {
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  return validTypes.includes(mimeType);
}

// Validate video MIME types
export function isValidVideoType(mimeType: string): boolean {
  const validTypes = ['video/mp4', 'video/webm', 'video/ogg'];
  return validTypes.includes(mimeType);
}
