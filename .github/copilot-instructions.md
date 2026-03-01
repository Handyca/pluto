# GitHub Copilot Instructions — Pluto

## Project Overview
Pluto is a production Next.js 16 (App Router) real-time presentation chat application.  
Admins create sessions; participants join via a 6-character code and send messages/images in real-time.

**Stack:**
- **Framework:** Next.js 16.1.6 — App Router, React Server Components, TypeScript strict
- **Auth:** next-auth v5 beta — Credentials provider, JWT session, `requireAdmin()` helper
- **Database:** PostgreSQL via Prisma 7 + PgBouncer adapter (`lib/prisma.ts` singleton)
- **Storage/Realtime:** Supabase — Storage (`uploads` bucket) + Realtime broadcast
- **Validation:** Zod v4 (`lib/schemas.ts` owns canonical schemas)
- **Data fetching:** TanStack Query v5 hooks in `lib/hooks/`
- **UI:** Tailwind v4 + shadcn/ui (`components/ui/`)
- **Deployment:** Vercel (serverless, read-only filesystem, 4.5 MB body limit)

---

## Architectural Rules

### API Routes
- Every admin API route **must** start with `const { admin, response } = await requireAdmin(); if (response) return response;`
- Every public API route that accepts a participant token **must** call `verifyParticipantToken(token)` from `lib/participant-auth.ts`
- **Never** return raw error messages from caught exceptions — always return generic strings like `'Internal server error'`
- All request bodies **must** be validated with a Zod schema before use
- `themeConfig` in session routes **must** use `ThemeConfigSchema` from `lib/schemas.ts`, not `z.record(z.string(), z.any())`
- Pagination `limit` params **must** be capped: `Math.min(Math.max(1, raw), 200)`
- Cursor `before` params must be validated as ISO dates before passing to `new Date()`

### File Uploads
- **Never** write files to disk — Vercel's filesystem is read-only
- Use the three-step Supabase signed upload flow implemented in `lib/hooks/use-messages.ts`:
  1. `POST /api/upload/sign` → receive `{ signedUrl, path, publicUrl }`
  2. `PUT signedUrl` with raw file bytes (direct to Supabase Storage)
  3. `POST /api/upload/confirm` → save `MediaAsset` DB record
- `publicUrl` is **always derived server-side** from the storage path — never trust the client-supplied value

### Realtime
- All broadcast calls go through `lib/ws-manager.ts` helpers (`broadcastNewMessage`, etc.)
- **Never** use the raw Supabase REST API for broadcasts — use `getSupabaseServerClient().channel(...).send()`
- Channel naming convention: `session:${sessionId}` (no `realtime:` prefix)

### Auth / Proxy
- `proxy.ts` is the Next.js 16 equivalent of `middleware.ts` — **never** create a `middleware.ts`
- The proxy matcher **must** include `/api/admin/:path*` to protect admin API routes at the edge
- Admin liveness check is done inside `requireAdmin()` — no need to re-query `prisma.admin` in route handlers

### Session Codes
- Generated via `generateSessionCode()` in `lib/utils.ts` — uses `crypto.getRandomValues()`, do not replace with `Math.random()`

### Rate Limiting
- `lib/rate-limit.ts` provides in-memory limiters — **these are ineffective on Vercel serverless**
- For production rate-limiting, integrate Upstash Redis via `@upstash/ratelimit`
- Never remove existing rate-limiter call sites; upgrade them to Upstash when adding the dependency

### Environment Variables
- `getSupabaseServerClient()` throws at startup if `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` are missing
- `getSupabaseBrowserClient()` silently falls back (browser context may not have server vars)
- All required env vars are documented in `.env.example` — keep it up to date

---

## File Map

| Path | Purpose |
|------|---------|
| `proxy.ts` | Edge auth middleware (replaces `middleware.ts` in Next.js 16) |
| `lib/auth.ts` | next-auth config + `requireAdmin()` helper |
| `lib/prisma.ts` | Prisma singleton with PgBouncer adapter |
| `lib/supabase.ts` | `getSupabaseBrowserClient()` + `getSupabaseServerClient()` |
| `lib/ws-manager.ts` | Supabase Realtime broadcast helpers |
| `lib/schemas.ts` | Canonical Zod schemas: `ThemeConfigSchema`, `DEFAULT_THEME_CONFIG` |
| `lib/rate-limit.ts` | In-memory rate limiters (upgrade to Upstash for multi-instance) |
| `lib/participant-auth.ts` | JWT-based participant token sign/verify |
| `lib/utils.ts` | `generateSessionCode()` (crypto-secure), `cn()` class merger |
| `lib/hooks/` | TanStack Query hooks for all client data fetching |
| `app/api/upload/sign/route.ts` | Step 1: validate + issue Supabase signed upload URL |
| `app/api/upload/confirm/route.ts` | Step 3: persist `MediaAsset` record after successful upload |
| `components/ui/` | shadcn/ui primitives — do not modify directly |
| `prisma/schema.prisma` | DB schema — run `prisma migrate dev` after changes |

---

## Code Style

- TypeScript strict mode — no `any` except in well-commented exceptions
- Zod v4 API: `z.string().min(1)`, `z.enum([...])`, `.safeParse()` for user input, `.parse()` for trusted internal use
- TanStack Query v5: `queryKey` arrays, `useMutation({ mutationFn })`, prefer `setQueryData` over `invalidateQueries` for optimistic updates
- Tailwind v4: use `cn()` from `lib/utils.ts` for conditional class merging
- No `console.log` in production code — use structured logging or remove
- All async route handlers must be wrapped in try/catch with a final `return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })` fallback

---

## Common Patterns

### Admin API route template
```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const BodySchema = z.object({ /* ... */ });

export async function POST(req: NextRequest) {
  try {
    const { admin, response } = await requireAdmin();
    if (response) return response;

    const json = await req.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
    }

    // ... handler logic using admin.id ...

    return NextResponse.json({ success: true, data: result });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
```

### Participant route template
```ts
import { verifyParticipantToken } from '@/lib/participant-auth';

const participant = await verifyParticipantToken(token);
if (!participant) {
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}
```

---

## What NOT to do
- ❌ `middleware.ts` — use `proxy.ts`
- ❌ `fs.writeFile` / local disk writes — use Supabase Storage
- ❌ Return `error.message` from caught exceptions in API responses
- ❌ `Math.random()` for security-sensitive tokens or codes
- ❌ Trust `publicUrl` or `path` from client in upload confirm flow
- ❌ `z.record(z.string(), z.any())` for `themeConfig` — use `ThemeConfigSchema`
- ❌ Raw Supabase REST broadcast — use `ws-manager.ts` helpers
- ❌ `auth()` in admin routes — use `requireAdmin()`
- ❌ Unbounded query limits — always cap with `Math.min(raw, 200)`
