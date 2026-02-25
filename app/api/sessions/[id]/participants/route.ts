import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// GET /api/sessions/[id]/participants
// Returns all participants for a session with message counts.
// Only the admin who owns the session can access this.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify ownership
    const sessionData = await prisma.session.findUnique({
      where: { id },
      select: { adminId: true, title: true, code: true, isActive: true },
    });

    if (!sessionData) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    if (sessionData.adminId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const participants = await prisma.participant.findMany({
      where: { sessionId: id },
      include: {
        _count: { select: { messages: true } },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: { session: sessionData, participants },
    });
  } catch (error) {
    console.error('Error fetching participants:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch participants' },
      { status: 500 }
    );
  }
}
