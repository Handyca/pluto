import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

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
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

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

    if (message.session.adminId !== session.user.id) {
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

    return NextResponse.json({
      success: true,
      data: updatedMessage,
      message: 'Message updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid data', details: error.errors },
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
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

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

    if (message.session.adminId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    await prisma.message.delete({
      where: { id },
    });

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
