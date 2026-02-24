export { auth as middleware } from '@/lib/auth';

export const config = {
  matcher: ['/admin/:path*', '/api/sessions/:path*', '/api/messages/:path*', '/api/upload/:path*'],
};
