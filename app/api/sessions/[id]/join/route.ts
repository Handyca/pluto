import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateAnonymousId } from '@/lib/utils';
import { createParticipantToken } from '@/lib/participant-auth';
import { z } from 'zod';
export const runtime = 'nodejs';
const joinSchema = z.object({
  participantName: z.string().min(1).max(50),
  anonymousId: z.string().optional(),
});

// POST /api/sessions/[id]/join - Join session as participant (id = session code)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: code } = await params;
    const body = await request.json();
    const { participantName, anonymousId: providedAnonymousId } = joinSchema.parse(body);

    // Find session by code
    const session = await prisma.session.findUnique({
      where: { code },
      include: {
        _count: {
          select: { participants: true },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    if (!session.isActive) {
      return NextResponse.json(
        { success: false, error: 'Session is not active' },
        { status: 403 }
      );
    }

    // Generate or use provided anonymous ID
    const anonymousId = providedAnonymousId || generateAnonymousId();

    // Check if participant already exists
    let participant = await prisma.participant.findUnique({
      where: {
        sessionId_anonymousId: {
          sessionId: session.id,
          anonymousId,
        },
      },
    });

    if (participant) {
      // Update last seen
      participant = await prisma.participant.update({
        where: { id: participant.id },
        data: { lastSeenAt: new Date(), nickname: participantName },
      });
    } else {
      // Create new participant
      participant = await prisma.participant.create({
        data: {
          sessionId: session.id,
          anonymousId,
          nickname: participantName,
        },
      });
    }

    // Create participant token
    const token = await createParticipantToken(
      session.id,
      session.code,
      participant.id,
      participantName,
      anonymousId
    );

    return NextResponse.json({
      success: true,
      data: {
        session: {
          id: session.id,
          title: session.title,
          code: session.code,
          backgroundType: session.backgroundType,
          backgroundUrl: session.backgroundUrl,
          themeConfig: session.themeConfig,
        },
        participant: {
          id: participant.id,
          nickname: participant.nickname,
          anonymousId: participant.anonymousId,
        },
        token,
      },
      message: 'Joined session successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error joining session:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to join session' },
      { status: 500 }
    );
  }
}

// GET /api/sessions/[id]/join - Get session info by code (public)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: code } = await params;

    const session = await prisma.session.findUnique({
      where: { code },
      select: {
        id: true,
        title: true,
        code: true,
        isActive: true,
        _count: {
          select: { participants: true },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: session,
    });
  } catch (error) {
    console.error('Error fetching session info:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch session info' },
      { status: 500 }
    );
  }
}
