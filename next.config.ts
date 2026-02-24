import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Prisma out of the Next.js bundle so it uses the native Node.js
  // library engine from node_modules at runtime (required for Supabase/PostgreSQL).
  serverExternalPackages: ['@prisma/client', 'prisma'],
};

export default nextConfig;
