import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getWsManager } from '@/lib/ws-manager';

export const runtime = 'nodejs';

const updateSessionSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  backgroundType: z.enum(['color', 'image', 'video']).optional(),
  backgroundUrl: z.string().optional().nullable(),
  themeConfig: z.record(z.string(), z.any()).optional(),
  code: z.string().min(3).max(20).regex(/^[A-Z0-9-]+$/).optional(),
});

// GET /api/sessions/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { admin, response } = await requireAdmin();
    if (response) return response;

    const sessionData = await prisma.session.findUnique({
      where: { id },
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
        participants: {
          orderBy: { joinedAt: 'desc' },
          take: 200, // Cap to prevent unbounded memory usage
        },
        _count: {
          select: {
            messages: true,
            participants: true,
          },
        },
      },
    });

    if (!sessionData) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (sessionData.adminId !== admin.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: sessionData,
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch session' },
      { status: 500 }
    );
  }
}

// PATCH /api/sessions/[id] - Update session
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { admin, response } = await requireAdmin();
    if (response) return response;

    // Verify ownership
    const existingSession = await prisma.session.findUnique({
      where: { id },
    });

    if (!existingSession) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    if (existingSession.adminId !== admin.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = updateSessionSchema.parse(body);

    // Check code uniqueness if changing it
    if (validatedData.code && validatedData.code !== existingSession.code) {
      const existingCode = await prisma.session.findUnique({ where: { code: validatedData.code } });
      if (existingCode) {
        return NextResponse.json({ success: false, error: 'Session code already in use' }, { status: 409 });
      }
    }

    const updatedSession = await prisma.session.update({
      where: { id },
      data: validatedData,
    });

    // Broadcast real-time updates to all clients watching this session.
    const wsManager = getWsManager();
    if (wsManager) {
      if ('backgroundType' in validatedData || 'backgroundUrl' in validatedData) {
        wsManager.broadcastBackgroundUpdate(
          id,
          updatedSession.backgroundType,
          updatedSession.backgroundUrl ?? undefined,
        );
      }
      if ('themeConfig' in validatedData) {
        wsManager.broadcastThemeUpdate(id, updatedSession.themeConfig);
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedSession,
      message: 'Session updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error updating session:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update session' },
      { status: 500 }
    );
  }
}

// DELETE /api/sessions/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { admin, response } = await requireAdmin();
    if (response) return response;

    // Verify ownership
    const existingSession = await prisma.session.findUnique({
      where: { id },
    });

    if (!existingSession) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    if (existingSession.adminId !== admin.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    await prisma.session.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Session deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting session:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}
