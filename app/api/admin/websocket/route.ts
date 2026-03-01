import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getRealtimeStatus } from '@/lib/ws-manager';

export const runtime = 'nodejs';

export async function GET() {
  const { admin, response } = await requireAdmin();
  if (response) return response;

  const [realtimeStatus, activeSessions] = await Promise.all([
    getRealtimeStatus(),
    prisma.session.findMany({
      where: { adminId: admin.id, isActive: true },
      select: {
        id: true,
        title: true,
        code: true,
        createdAt: true,
        _count: {
          select: { messages: true, participants: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const totalMessages = activeSessions.reduce((s, r) => s + r._count.messages, 0);
  const totalParticipants = activeSessions.reduce((s, r) => s + r._count.participants, 0);

  return NextResponse.json({
    success: true,
    data: {
      available: realtimeStatus.available,
      projectUrl: realtimeStatus.projectUrl,
      activeSessionCount: activeSessions.length,
      totalMessages,
      totalParticipants,
      rooms: activeSessions.map((s) => ({
        sessionId: s.id,
        sessionTitle: s.title,
        sessionCode: s.code,
        messageCount: s._count.messages,
        participantCount: s._count.participants,
      })),
    },
  });
}

