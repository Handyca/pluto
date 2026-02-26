import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getWsManager } from '@/lib/ws-manager';

export const runtime = 'nodejs';

const updateMessageSchema = z.object({
  isVisible: z.boolean().optional(),
  isPinned: z.boolean().optional(),
});

// PATCH /api/messages/[id] - Update message (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { admin, response } = await requireAdmin();
    if (response) return response;

    // Verify message exists and admin owns the session
    const message = await prisma.message.findUnique({
      where: { id },
      include: { session: true },
    });

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }

    if (message.session.adminId !== admin.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = updateMessageSchema.parse(body);

    const updatedMessage = await prisma.message.update({
      where: { id },
      data: validatedData,
    });

    // Broadcast visibility/pin change to all connected clients in real-time.
    getWsManager()?.broadcastMessageUpdate(message.sessionId, id, validatedData);

    return NextResponse.json({
      success: true,
      data: updatedMessage,
      message: 'Message updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error updating message:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update message' },
      { status: 500 }
    );
  }
}

// DELETE /api/messages/[id] - Delete message (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { admin, response } = await requireAdmin();
    if (response) return response;

    // Verify message exists and admin owns the session
    const message = await prisma.message.findUnique({
      where: { id },
      include: { session: true },
    });

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }

    if (message.session.adminId !== admin.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    await prisma.message.delete({
      where: { id },
    });

    // Broadcast deletion to all connected clients in real-time.
    getWsManager()?.broadcastMessageDelete(message.sessionId, id);

    return NextResponse.json({
      success: true,
      message: 'Message deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete message' },
      { status: 500 }
    );
  }
}
