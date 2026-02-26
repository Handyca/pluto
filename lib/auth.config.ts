import type { NextAuthConfig } from 'next-auth';

/**
 * NextAuth configuration used in the Next.js Proxy (proxy.ts).
 * In Next.js 16, Proxy runs on the Node.js runtime by default (no longer Edge).
 * Prisma/bcrypt logic still lives in lib/auth.ts to keep auth concerns separated;
 * this file only carries the lightweight JWT/session callbacks needed at the
 * proxy layer for route protection.
 */
export const authConfig = {
  providers: [], // providers are added in lib/auth.ts
  pages: {
    signIn: '/admin/login',
  },
  callbacks: {
    authorized: async ({ auth, request: { nextUrl } }) => {
      const isLoggedIn = !!auth?.user;
      const isOnAdminPanel = nextUrl.pathname.startsWith('/admin');
      const isOnLoginPage = nextUrl.pathname.startsWith('/admin/login');
      const isOnPresenterPage = nextUrl.pathname.startsWith('/presenter');

      // Protect admin routes
      if (isOnAdminPanel && !isOnLoginPage) {
        return isLoggedIn;
      }

      // Presenter is admin-only (admins display it on a second screen)
      if (isOnPresenterPage) {
        return isLoggedIn;
      }

      // Redirect already-logged-in users away from the login page
      if (isOnLoginPage && isLoggedIn) {
        return Response.redirect(new URL('/admin', nextUrl));
      }

      return true;
    },
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
    // Tokens expire after 8 hours; users must re-authenticate.
    maxAge: 8 * 60 * 60,
  },
} satisfies NextAuthConfig;
