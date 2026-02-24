import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateSessionCode } from '@/lib/utils';
import { z } from 'zod';

export const runtime = 'nodejs';

const createSessionSchema = z.object({
  title: z.string().min(1).max(100),
  backgroundType: z.enum(['color', 'image', 'video']).optional(),
  backgroundUrl: z.string().url().optional().nullable(),
  themeConfig: z.record(z.string(), z.any()).optional(),
});

// GET /api/sessions - Get all sessions for admin
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const sessions = await prisma.session.findMany({
      where: {
        adminId: session.user.id,
      },
      include: {
        _count: {
          select: {
            messages: true,
            participants: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

// POST /api/sessions - Create new session
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = createSessionSchema.parse(body);

    // Generate unique session code
    let code: string;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      code = generateSessionCode();
      const existing = await prisma.session.findUnique({
        where: { code },
      });
      if (!existing) {
        isUnique = true;
        break;
      }
      attempts++;
    }

    if (!isUnique) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate unique code' },
        { status: 500 }
      );
    }

    const newSession = await prisma.session.create({
      data: {
        title: validatedData.title,
        code: code!,
        adminId: session.user.id,
        backgroundType: validatedData.backgroundType || 'color',
        backgroundUrl: validatedData.backgroundUrl,
        themeConfig: validatedData.themeConfig || {
          primary: '#3b82f6',
          secondary: '#8b5cf6',
          background: '#1e293b',
          text: '#f1f5f9',
          chatOverlay: 'rgba(15,23,42,0.9)',
          fontFamily: 'Inter',
          fontSize: '16',
          chatPosition: 'right',
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: newSession,
      message: 'Session created successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error creating session:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
