import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getWsStats, sendWsAction, getWsInternalUrl, readWsRuntimeConfig, writeWsRuntimeConfig } from '@/lib/ws-manager';
import { z } from 'zod';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await getWsStats();

  if (!result.available) {
    return NextResponse.json({
      success: true,
      data: {
        totalConnections: 0,
        activeRooms: 0,
        rooms: [],
        available: false,
        isPaused: false,
        logLevel: 'info',
        serverPort: null,
        serverUrl: null,
        internalUrl: result.internalUrl,
      },
    });
  }

  return NextResponse.json({ success: true, data: { ...result, available: true } });
}

const actionSchema = z.object({
  action: z.enum(['pause', 'resume', 'disconnect_all', 'set_log_level', 'update_url']),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  internalUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  }

  const { action, logLevel, internalUrl } = parsed.data;

  // update_url is handled entirely in Next.js (writes to the runtime config)
  if (action === 'update_url') {
    if (!internalUrl) {
      return NextResponse.json({ success: false, error: 'internalUrl is required' }, { status: 400 });
    }
    const existing = readWsRuntimeConfig();
    writeWsRuntimeConfig({ ...existing, internalUrl });
    // Probe the new URL to verify it's reachable
    const probe = await getWsStats();
    return NextResponse.json({
      success: true,
      data: probe.available
        ? { ...probe }
        : { available: false, internalUrl },
    });
  }

  // All other actions proxy through to the WS management API
  const stats = await sendWsAction(action, logLevel ? { logLevel } : undefined);
  if (!stats) {
    return NextResponse.json({ success: false, error: 'WebSocket server not available' }, { status: 503 });
  }

  const internalUrlCurrent = getWsInternalUrl();
  const serverUrl = internalUrlCurrent.replace(/^http/, 'ws') + '/ws';
  return NextResponse.json({ success: true, data: { ...stats, available: true, serverUrl, internalUrl: internalUrlCurrent } });
}

