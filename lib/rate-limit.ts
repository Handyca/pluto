/**
 * Simple in-memory rate limiter (no external dependencies).
 * Suitable for single-node deployments. Replace with an Upstash/Redis
 * backed limiter if you scale to multiple instances.
 *
 * Usage:
 *   const limiter = new RateLimiter({ maxRequests: 10, windowMs: 60_000 });
 *   if (limiter.isRateLimited(ip)) {
 *     return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
 *   }
 */

interface RateLimiterOptions {
  /** Maximum requests allowed within the window. */
  maxRequests: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

interface RequestRecord {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly store = new Map<string, RequestRecord>();
  private pruneInterval: ReturnType<typeof setInterval> | null = null;

  constructor({ maxRequests, windowMs }: RateLimiterOptions) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    // Prune stale entries every 5 minutes to prevent unbounded memory growth.
    this.pruneInterval = setInterval(() => this.prune(), 5 * 60 * 1000);
    // Don't block process exit.
    if (this.pruneInterval.unref) this.pruneInterval.unref();
  }

  /**
   * Returns true if the given key has exceeded the rate limit.
   * Increments the counter on every call.
   */
  isRateLimited(key: string): boolean {
    const now = Date.now();
    const record = this.store.get(key);

    if (!record || now >= record.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + this.windowMs });
      return false;
    }

    record.count++;
    if (record.count > this.maxRequests) return true;
    return false;
  }

  /**
   * Returns remaining requests allowed for the key (-1 means unknown/new window).
   */
  remaining(key: string): number {
    const now = Date.now();
    const record = this.store.get(key);
    if (!record || now >= record.resetAt) return this.maxRequests;
    return Math.max(0, this.maxRequests - record.count);
  }

  private prune() {
    const now = Date.now();
    for (const [key, record] of this.store) {
      if (now >= record.resetAt) this.store.delete(key);
    }
  }

  destroy() {
    if (this.pruneInterval) clearInterval(this.pruneInterval);
  }
}

// ---------------------------------------------------------------------------
// Shared limiter instances — one per endpoint category
// ---------------------------------------------------------------------------

/** Login: 10 attempts per 15 minutes per IP. */
export const loginLimiter = new RateLimiter({ maxRequests: 10, windowMs: 15 * 60 * 1000 });

/** Session join: 20 per minute per IP. */
export const joinLimiter = new RateLimiter({ maxRequests: 20, windowMs: 60 * 1000 });

/** Message creation (HTTP): 30 per minute per participant. */
export const messageLimiter = new RateLimiter({ maxRequests: 30, windowMs: 60 * 1000 });

/** File upload: 10 per minute per user (IP or participant ID). */
export const uploadLimiter = new RateLimiter({ maxRequests: 10, windowMs: 60 * 1000 });

/** WebSocket message send: 20 per 10 seconds per participant. */
export const wsMessageLimiter = new RateLimiter({ maxRequests: 20, windowMs: 10 * 1000 });

// ---------------------------------------------------------------------------
// Helper: extract the best available IP from a Next.js Request
// ---------------------------------------------------------------------------
export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}
