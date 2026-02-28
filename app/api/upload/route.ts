/**
 * GET /api/upload — list media assets.
 *
 * File uploads are handled by:
 *   POST /api/upload/sign    — validate & get Supabase signed upload URL
 *   PUT  <signedUrl>         — client uploads directly to Supabase Storage
 *   POST /api/upload/confirm — save DB record
 *
 * This split avoids FUNCTION_PAYLOAD_TOO_LARGE on Vercel (4.5 MB body limit).
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MediaType } from '@prisma/client';
import { z } from 'zod';

const ALLOWED_MEDIA_TYPES = z.nativeEnum(MediaType);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // Optional filter by type

    const session = await auth();
    if (!session?.user) {
      if (!type || type.toUpperCase() !== 'STICKER') {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    let typeFilter: MediaType | undefined;
    if (type) {
      const parsedMediaType = ALLOWED_MEDIA_TYPES.safeParse(type.toUpperCase());
      if (!parsedMediaType.success) {
        return NextResponse.json(
          { success: false, error: 'Invalid type filter' },
          { status: 400 }
        );
      }
      typeFilter = parsedMediaType.data;
    }

    const mediaAssets = await prisma.mediaAsset.findMany({
      where: typeFilter ? { type: typeFilter } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: mediaAssets,
    });
  } catch (error) {
    console.error('Error fetching media assets:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch media assets' },
      { status: 500 }
    );
  }
}
