import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const activeSessions = await prisma.session.count({
      where: { isActive: true },
    });

    const totalParticipants = await prisma.participant.count();

    const totalMessages = await prisma.message.count();

    // Calculate uptime (placeholder - in real scenario track from server start)
    const uptime = '99.8%';

    return NextResponse.json({
      success: true,
      data: {
        activeSessions,
        totalParticipants,
        totalMessages,
        wsConnected: true,
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
