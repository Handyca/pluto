#!/usr/bin/env bash
# Build script for pluto-app (Next.js) on Render.
# Render runs this from the repo root as the working directory.
set -euo pipefail

echo "▶ Installing dependencies (Bun)..."
bun install --frozen-lockfile

echo "▶ Generating Prisma client..."
bunx prisma generate

echo "▶ Running database migrations..."
bunx prisma migrate deploy

echo "▶ Building Next.js..."
bun run build

echo "✅ Build complete."
