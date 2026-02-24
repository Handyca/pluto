import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

// Use the edge-safe auth config (no Prisma) so the middleware can run on the
// Edge Runtime. JWT verification does not require a database connection.
const { auth } = NextAuth(authConfig);
export const middleware = auth;

export const config = {
  matcher: ['/admin/:path*', '/api/sessions/:path*', '/api/messages/:path*', '/api/upload/:path*'],
};
