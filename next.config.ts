import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Prisma out of the Next.js bundle so it uses the native Node.js
  // library engine from node_modules at runtime (required for Supabase/PostgreSQL).
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'prisma', 'pg', 'sharp'],
  experimental: {
    // Next.js wraps every non-GET request body in a clonable stream with a
    // default 10MB cap. Files larger than that are truncated, dropping the
    // closing multipart boundary and causing a 400 "Missing final boundary"
    // error. Raise the cap to match the largest allowed upload (100MB video).
    proxyClientMaxBodySize: '110mb',
  },
};

export default nextConfig;
