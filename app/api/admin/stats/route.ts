import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getWsStats } from '@/lib/ws-manager';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { admin, response } = await requireAdmin();
    if (response) return response;

    // Run all counts + WS stats in parallel.
    const [activeSessions, totalParticipants, totalMessages, wsResult] = await Promise.all([
      prisma.session.count({ where: { adminId: admin.id, isActive: true } }),
      prisma.participant.count({
        where: { session: { adminId: admin.id } },
      }),
      prisma.message.count({
        where: { session: { adminId: admin.id } },
      }),
      getWsStats(),
    ]);

    const wsConnected = wsResult.available;
    const wsStats = wsResult.available ? wsResult : null;
    // Uptime derived from process start time (accurate for single-process setup).
    const uptimeSeconds = Math.floor(process.uptime());
    const uptimeHours = Math.floor(uptimeSeconds / 3600);
    const uptimeMins = Math.floor((uptimeSeconds % 3600) / 60);
    const uptimeSecs = uptimeSeconds % 60;
    const uptime = `${String(uptimeHours).padStart(2,'0')}:${String(uptimeMins).padStart(2,'0')}:${String(uptimeSecs).padStart(2,'0')}`;

    return NextResponse.json({
      success: true,
      data: {
        activeSessions,
        totalParticipants,
        totalMessages,
        wsConnected,
        wsConnections: wsStats?.totalConnections ?? 0,
        wsRooms: wsStats?.activeRooms ?? 0,
        latency: 0,
        uptime,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error fetching stats:', message, error);
    return NextResponse.json(
      { success: false, error: message || 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
