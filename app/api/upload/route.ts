import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { isValidImageType, isValidVideoType } from '@/lib/utils';

export const runtime = 'nodejs';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string; // 'image', 'video', 'sticker'

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const isImage = isValidImageType(file.type);
    const isVideo = isValidVideoType(file.type);

    if (type === 'image' && !isImage) {
      return NextResponse.json(
        { success: false, error: 'Invalid image file type' },
        { status: 400 }
      );
    }

    if (type === 'video' && !isVideo) {
      return NextResponse.json(
        { success: false, error: 'Invalid video file type' },
        { status: 400 }
      );
    }

    // Validate file size
    if (isImage && file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'Image file too large (max 5MB)' },
        { status: 400 }
      );
    }

    if (isVideo && file.size > MAX_VIDEO_SIZE) {
      return NextResponse.json(
        { success: false, error: 'Video file too large (max 50MB)' },
        { status: 400 }
      );
    }

    // Generate unique filename — use built-in crypto so there is no ESM dep.
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const filename = `${crypto.randomUUID()}.${ext}`;
    const uploadDir = join(process.cwd(), 'public', 'uploads', type);
    
    // Ensure upload directory exists
    await mkdir(uploadDir, { recursive: true });

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filepath = join(uploadDir, filename);
    await writeFile(filepath, buffer);

    // Create media asset record
    const mediaAsset = await prisma.mediaAsset.create({
      data: {
        type: type === 'image' ? 'IMAGE' : type === 'video' ? 'VIDEO' : 'STICKER',
        url: `/uploads/${type}/${filename}`,
        filename,
        mimeType: file.type,
        size: file.size,
        uploadedBy: session.user?.id ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: mediaAsset.id,
        url: mediaAsset.url,
        filename: mediaAsset.filename,
        size: mediaAsset.size,
        mimeType: mediaAsset.mimeType,
      },
      message: 'File uploaded successfully',
    });
  } catch (error) {
    // Surface the real error message so the client toast is informative.
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error uploading file:', message, error);
    return NextResponse.json(
      { success: false, error: message || 'Failed to upload file' },
      { status: 500 }
    );
  }
}

// GET /api/upload - Get all media assets
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // Optional filter by type

    const mediaAssets = await prisma.mediaAsset.findMany({
      where: type ? { type: type.toUpperCase() as any } : undefined,
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
