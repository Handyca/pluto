import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { isValidImageType, isValidVideoType, resolveFileMime } from '@/lib/utils';
import { verifyParticipantToken } from '@/lib/participant-auth';
import { MediaType } from '@prisma/client';
import sharp from 'sharp';
import { z } from 'zod';
import { uploadLimiter, getClientIp } from '@/lib/rate-limit';

const ALLOWED_UPLOAD_TYPES = z.enum(['image', 'video', 'sticker']);
const ALLOWED_MEDIA_TYPES = z.nativeEnum(MediaType);

export const runtime = 'nodejs';

const MAX_IMAGE_SIZE = 30 * 1024 * 1024; // 30MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB (increased for better video support)

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { success: false, error: 'Invalid content type (expected multipart/form-data)' },
        { status: 415 }
      );
    }
    if (!contentType.includes('boundary=')) {
      return NextResponse.json(
        { success: false, error: 'Invalid multipart form data (missing boundary)' },
        { status: 400 }
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (error: unknown) {
      console.error('FormData parsing error:', error);
      
      // Provide more specific error messages
      const errMsg = error instanceof Error ? error.message : '';
      let message = 'Invalid multipart form data';
      if (errMsg.includes('boundary')) {
        message = 'Missing final boundary in multipart form data. File may be too large or upload was interrupted.';
      } else if (errMsg.includes('unexpected end')) {
        message = 'Upload was interrupted before completion. Please try again.';
      } else {
        message = errMsg || message;
      }
      
      return NextResponse.json(
        { success: false, error: message },
        { status: 400 }
      );
    }
    const file = formData.get('file') as File | null;
    const rawType = formData.get('type') as string | null;
    const participantToken = formData.get('participantToken') as string | null;

    // Validate the type field to prevent path traversal attacks.
    const parsedType = ALLOWED_UPLOAD_TYPES.safeParse(rawType);
    if (!parsedType.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid upload type (must be image, video, or sticker)' },
        { status: 400 }
      );
    }
    const type = parsedType.data;

    const session = await auth();

    // Rate limit: 10 uploads per minute per IP or participant.
    const ip = getClientIp(request);
    if (uploadLimiter.isRateLimited(ip)) {
      return NextResponse.json(
        { success: false, error: 'Too many uploads — please wait and try again' },
        { status: 429 }
      );
    }
    let participant = null;
    if (!session?.user) {
      if (participantToken) {
        participant = await verifyParticipantToken(participantToken);
      }
      if (!participant) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
      if (type !== 'image') {
        return NextResponse.json(
          { success: false, error: 'Participants can only upload images' },
          { status: 403 }
        );
      }
    }

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type — fall back to extension when file.type is empty
    const resolvedMime = resolveFileMime(file);
    const isImage = isValidImageType(resolvedMime);
    const isVideo = isValidVideoType(resolvedMime);

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
        { success: false, error: 'Image file too large (max 30MB)' },
        { status: 400 }
      );
    }

    if (isVideo && file.size > MAX_VIDEO_SIZE) {
      return NextResponse.json(
        { success: false, error: 'Video file too large (max 100MB)' },
        { status: 400 }
      );
    }

    // Generate unique filename — use built-in crypto so there is no ESM dep.
    const uploadDir = join(process.cwd(), 'public', 'uploads', type);
    await mkdir(uploadDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    let buffer = Buffer.from(bytes);
    let finalMime = resolvedMime || file.type;
    let ext = file.name.split('.').pop()?.toLowerCase() || 'bin';

    // For images: resize to max 1920×1080, strip metadata, convert to WebP.
    // This keeps file sizes small and ensures consistent quality on screen.
    if (isImage) {
      const processedBuffer = await sharp(buffer)
        .rotate() // auto-orient from EXIF
        .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
      buffer = Buffer.from(processedBuffer);
      finalMime = 'image/webp';
      ext = 'webp';
    }

    const filename = `${crypto.randomUUID()}.${ext}`;
    const filepath = join(uploadDir, filename);
    await writeFile(filepath, buffer);

    // Create media asset record
    const mediaAsset = await prisma.mediaAsset.create({
      data: {
        type: type === 'image' ? 'IMAGE' : type === 'video' ? 'VIDEO' : 'STICKER',
        url: `/uploads/${type}/${filename}`,
        filename,
        mimeType: finalMime,
        size: buffer.length,
        uploadedBy: session?.user?.id ?? null,
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
