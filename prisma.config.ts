// This file is used by the Prisma CLI (migrate, studio, db push, etc.).
// Assumes you run Prisma commands using `bun --bun run prisma [command]`.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use the direct (non-pooled) URL for CLI operations and migrations.
    // Supabase's PgBouncer (pooler) doesn't support the DDL queries that
    // migrations require, so we must bypass it here.
    url: env("DIRECT_URL"),
  },
});
