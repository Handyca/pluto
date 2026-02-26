#!/usr/bin/env bash
# Build script for pluto-ws (standalone WebSocket server) on Render.
# Only needs to install dependencies — no Next.js build required.
set -euo pipefail

echo "▶ Installing dependencies (Bun)..."
bun install --frozen-lockfile

echo "▶ Generating Prisma client (needed by websocket.ts)..."
bunx prisma generate

echo "✅ WS server build complete."
