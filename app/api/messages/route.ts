import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyParticipantToken, extractParticipantToken } from '@/lib/participant-auth';
import { z } from 'zod';

const createMessageSchema = z.object({
  sessionId: z.string().cuid(),
  participantName: z.string().min(1).max(50),
  type: z.enum(['TEXT', 'IMAGE', 'STICKER', 'EMOJI']),
  content: z.string().max(1000),
  imageUrl: z.string().url().optional(),
  stickerUrl: z.string().url().optional(),
});

// GET /api/messages?sessionId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const before = searchParams.get('before'); // For pagination

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Verify access (either admin or participant)
    const session = await auth();
    const token = extractParticipantToken(request.headers);
    const participantSession = token ? await verifyParticipantToken(token) : null;

    if (!session?.user && !participantSession) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify session exists
    const sessionData = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!sessionData) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    // Admins can only see their own sessions
    if (session?.user && sessionData.adminId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Participants can only see messages from their session
    if (participantSession && participantSession.sessionId !== sessionId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const messages = await prisma.message.findMany({
      where: {
        sessionId,
        ...(before && {
          createdAt: {
            lt: new Date(before),
          },
        }),
        // Non-admins only see visible messages
        ...(participantSession && {
          isVisible: true,
        }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        participant: {
          select: {
            id: true,
            nickname: true,
            anonymousId: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: messages.reverse(), // Return in chronological order
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

// POST /api/messages - Create new message (handled by WebSocket, but kept for fallback)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createMessageSchema.parse(body);

    // Verify participant token
    const token = extractParticipantToken(request.headers);
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication token required' },
        { status: 401 }
      );
    }

    const participantSession = await verifyParticipantToken(token);
    if (!participantSession) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Verify session matches
    if (participantSession.sessionId !== validatedData.sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session mismatch' },
        { status: 403 }
      );
    }

    const message = await prisma.message.create({
      data: {
        sessionId: validatedData.sessionId,
        participantId: participantSession.participantId,
        participantName: validatedData.participantName,
        type: validatedData.type,
        content: validatedData.content,
        imageUrl: validatedData.imageUrl,
        stickerUrl: validatedData.stickerUrl,
      },
    });

    return NextResponse.json({
      success: true,
      data: message,
      message: 'Message created successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating message:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create message' },
      { status: 500 }
    );
  }
}
