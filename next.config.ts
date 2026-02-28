import type { NextConfig } from "next";

const supabaseHostname = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
  .replace(/^https?:\/\//, '')
  .split('/')[0];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      ...(supabaseHostname
        ? [{ protocol: 'https' as const, hostname: supabaseHostname }]
        : []),
    ],
  },
  // Keep Prisma out of the Next.js bundle so it uses the native Node.js
  // library engine from node_modules at runtime (required for Supabase/PostgreSQL).
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'prisma', 'pg', 'sharp'],
  experimental: {
    // Next.js wraps every non-GET request body in a clonable stream with a
    // default 10MB cap. Files larger than that are truncated, dropping the
    // closing multipart boundary and causing a 400 "Missing final boundary"
    // error. This raises the cap to match the largest allowed upload (100MB video).
    // Note: the /api/upload route validates the actual file size at the
    // application layer, so other endpoints are unaffected in practice.
    proxyClientMaxBodySize: '110mb',
  },
};

export default nextConfig;
