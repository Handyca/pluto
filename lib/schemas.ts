/**
 * Shared Zod validation schemas used across API routes and components.
 *
 * Centralising schemas here ensures that the same validation rules are applied
 * on every input boundary (HTTP routes, WebSocket handlers, and anywhere
 * Prisma Json scalars are read back).
 */
import { z } from 'zod';
import type { ThemeConfig } from '@/types';

// ---------------------------------------------------------------------------
// ThemeConfig
// ---------------------------------------------------------------------------

export const ThemeConfigSchema = z.object({
  primary: z.string().default('#3b82f6'),
  secondary: z.string().default('#8b5cf6'),
  background: z.string().default('#1e293b'),
  text: z.string().default('#f1f5f9'),
  chatOverlay: z.string().default('rgba(15,23,42,0.9)'),
  fontFamily: z.string().default('Inter'),
  fontSize: z.string().default('16'),
  chatPosition: z.enum(['left', 'right', 'bottom', 'top', 'center', 'full']).default('right'),
  chatMode: z.enum(['chat', 'wordCloud']).optional(),
  showTitle: z.boolean().optional(),
  showQrCode: z.boolean().optional(),
  bgObjectFit: z.enum(['cover', 'contain', 'fill']).optional(),
  bgObjectPosition: z.string().optional(),
});

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  primary: '#3b82f6',
  secondary: '#8b5cf6',
  background: '#1e293b',
  text: '#f1f5f9',
  chatOverlay: 'rgba(15,23,42,0.9)',
  fontFamily: 'Inter',
  fontSize: '16',
  chatPosition: 'right',
};

/**
 * Safely parse an unknown value (usually a Prisma Json scalar) into a
 * ThemeConfig, falling back to defaults for any missing or invalid fields.
 */
export function parseThemeConfig(raw: unknown): ThemeConfig {
  const result = ThemeConfigSchema.safeParse(raw);
  if (result.success) return result.data as ThemeConfig;
  // Merge defaults with whatever valid fields were present.
  const partial = typeof raw === 'object' && raw !== null ? raw : {};
  const merged = ThemeConfigSchema.safeParse({ ...DEFAULT_THEME_CONFIG, ...partial });
  return merged.success ? (merged.data as ThemeConfig) : DEFAULT_THEME_CONFIG;
}
