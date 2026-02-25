import { handlers } from '@/lib/auth';

// Credentials provider uses bcrypt + Prisma — both are Node.js-only.
// Explicitly declare Node.js runtime to prevent Turbopack/Edge fallback.
export const runtime = 'nodejs';

export const { GET, POST } = handlers;
