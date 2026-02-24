import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-compatible NextAuth configuration.
 * This file MUST NOT import any Node.js-only modules (e.g. Prisma, bcrypt)
 * because it is used in the Next.js middleware which runs on the Edge Runtime.
 *
 * The Credentials provider and any Prisma logic live in lib/auth.ts, which
 * is only ever executed in the Node.js server context.
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

      // Protect admin routes
      if (isOnAdminPanel && !isOnLoginPage) {
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
  },
} satisfies NextAuthConfig;
