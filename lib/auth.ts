import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { authConfig } from './auth.config';
import { loginLimiter } from './rate-limit';
import { NextResponse } from 'next/server';

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials, req) => {
        // Rate limit: 10 login attempts per 15 minutes per IP.
        const ip =
          (req as Request | undefined)?.headers?.get?.('x-forwarded-for')?.split(',')[0].trim() ??
          (req as Request | undefined)?.headers?.get?.('x-real-ip') ??
          'unknown';
        if (loginLimiter.isRateLimited(ip)) {
          throw new Error('Too many login attempts. Please wait and try again.');
        }

        const parsedCredentials = z
          .object({
            email: z.string().email(),
            password: z.string().min(6),
          })
          .safeParse(credentials);

        if (!parsedCredentials.success) {
          return null;
        }

        const { email, password } = parsedCredentials.data;

        const admin = await prisma.admin.findUnique({
          where: { email },
        });

        if (!admin) {
          return null;
        }

        const passwordMatch = await bcrypt.compare(password, admin.password);

        if (!passwordMatch) {
          return null;
        }

        return {
          id: admin.id,
          email: admin.email,
          name: admin.name || admin.email,
        };
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
});

// ---------------------------------------------------------------------------
// requireAdmin — call at the top of every admin API route handler.

export async function requireAdmin(): Promise<
  | { admin: { id: string; email: string; name: string | null }; response: null }
  | { admin: null; response: NextResponse }
> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      admin: null,
      response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const admin = await prisma.admin.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true },
  });

  if (!admin) {
    // JWT exists but the account was deleted — revoke by returning 401.
    return {
      admin: null,
      response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { admin, response: null };
}
