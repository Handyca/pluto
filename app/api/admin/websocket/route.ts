import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getWsManager } from '@/lib/ws-manager';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const manager = getWsManager();
  if (!manager) {
    return NextResponse.json({
      success: true,
      data: { totalConnections: 0, activeRooms: 0, rooms: [], available: false },
    });
  }

  const stats = manager.getStats();
  return NextResponse.json({ success: true, data: { ...stats, available: true } });
}
