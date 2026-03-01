import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

const { auth } = NextAuth(authConfig);

// Next.js 16: middleware.ts is renamed to proxy.ts, export must be named `proxy`
export const proxy = auth;

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/api/sessions/:path*',
    '/api/messages/:path*',
    '/api/upload/:path*',
  ],
};
