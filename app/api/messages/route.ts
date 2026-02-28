import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyParticipantToken, extractParticipantToken } from '@/lib/participant-auth';
import { z } from 'zod';
import { messageLimiter, getClientIp } from '@/lib/rate-limit';
import { getWsManager, broadcastNewMessage } from '@/lib/ws-manager';

export const runtime = 'nodejs';

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

    // Verify access (admin, participant, or public read for visible messages)
    const session = await auth();
    const token = extractParticipantToken(request.headers);
    const participantSession = token ? await verifyParticipantToken(token) : null;
    const isPublicAccess = !session?.user && !participantSession;

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

    // Public access is allowed for active sessions — visible messages only
    if (isPublicAccess && !sessionData.isActive) {
      return NextResponse.json(
        { success: false, error: 'Session not active' },
        { status: 403 }
      );
    }

    const messages = await prisma.message.findMany({
      where: {
        sessionId,
        ...(before && { createdAt: { lt: new Date(before) } }),
        // Non-admins (participants & public access) only see visible messages
        ...((participantSession || isPublicAccess) && { isVisible: true }),
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
    // Rate limit: 30 messages per minute per IP.
    const ip = getClientIp(request);
    if (messageLimiter.isRateLimited(ip)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests — please slow down' },
        { status: 429 }
      );
    }

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

    // Broadcast the new message to all Supabase Realtime subscribers.
    broadcastNewMessage(validatedData.sessionId, message);

    return NextResponse.json({
      success: true,
      data: message,
      message: 'Message created successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid data', details: error.issues },
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

// DELETE /api/messages?sessionId=xxx  — bulk delete all messages in a session (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'Session ID is required' }, { status: 400 });
    }

    // Verify the admin owns this session
    const sessionData = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!sessionData) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
    }
    if (sessionData.adminId !== session.user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    await prisma.message.deleteMany({ where: { sessionId } });

    // Notify all WebSocket clients watching this session to clear their message list.
    const wsManager = getWsManager();
    wsManager?.broadcastAllMessagesCleared(sessionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete messages error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
