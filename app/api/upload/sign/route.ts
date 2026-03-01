/**
 * POST /api/upload/sign
 *
 * Validates auth + file metadata, then returns a Supabase Storage signed
 * upload URL.  The client uploads the file *directly* to that URL — the
 * raw bytes never pass through a Vercel serverless function, so the
 * FUNCTION_PAYLOAD_TOO_LARGE limit is avoided entirely.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { verifyParticipantToken } from '@/lib/participant-auth';
import { getSupabaseServerClient } from '@/lib/supabase';
import { uploadLimiter, getClientIp } from '@/lib/rate-limit';
import { isValidImageType, isValidVideoType } from '@/lib/utils';
import { z } from 'zod';

const MAX_IMAGE_SIZE = 30 * 1024 * 1024;   // 30 MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;  // 100 MB
const MAX_STICKER_SIZE = 5 * 1024 * 1024;  // 5 MB

const BodySchema = z.object({
  type: z.enum(['image', 'video', 'sticker']),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(128),
  size: z.number().int().positive(),
  participantToken: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 },
      );
    }

    const { type, filename, mimeType, size, participantToken } = parsed.data;

    // ── Auth ──────────────────────────────────────────────────────────────
    const session = await auth();
    let participant = null;

    if (!session?.user) {
      if (participantToken) {
        participant = await verifyParticipantToken(participantToken);
      }
      if (!participant) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
      if (type !== 'image') {
        return NextResponse.json(
          { success: false, error: 'Participants can only upload images' },
          { status: 403 },
        );
      }
    }

    // ── Rate limit ────────────────────────────────────────────────────────
    const ip = getClientIp(request);
    if (uploadLimiter.isRateLimited(ip)) {
      return NextResponse.json(
        { success: false, error: 'Too many uploads — please wait and try again' },
        { status: 429 },
      );
    }

    // ── File type validation ──────────────────────────────────────────────
    const isImage = isValidImageType(mimeType);
    const isVideo = isValidVideoType(mimeType);

    if (type === 'image' && !isImage) {
      return NextResponse.json({ success: false, error: 'Invalid image file type' }, { status: 400 });
    }
    if (type === 'video' && !isVideo) {
      return NextResponse.json({ success: false, error: 'Invalid video file type' }, { status: 400 });
    }

    // ── File size validation ──────────────────────────────────────────────
    if (isImage && size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ success: false, error: 'Image too large (max 30 MB)' }, { status: 400 });
    }
    if (isVideo && size > MAX_VIDEO_SIZE) {
      return NextResponse.json({ success: false, error: 'Video too large (max 100 MB)' }, { status: 400 });
    }
    if (type === 'sticker' && size > MAX_STICKER_SIZE) {
      return NextResponse.json({ success: false, error: 'Sticker too large (max 5 MB)' }, { status: 400 });
    }

    // ── Generate signed upload URL ────────────────────────────────────────
    const ext = filename.split('.').pop()?.toLowerCase() || 'bin';
    const uniqueName = `${crypto.randomUUID()}.${ext}`;
    const storagePath = `${type}/${uniqueName}`;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.storage
      .from('uploads')
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      console.error('Supabase createSignedUploadUrl error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create upload URL' },
        { status: 500 },
      );
    }

    // Derive the public URL (no extra API call needed)
    const { data: publicUrlData } = supabase.storage.from('uploads').getPublicUrl(storagePath);

    return NextResponse.json({
      success: true,
      data: {
        signedUrl: data.signedUrl,
        path: storagePath,
        filename: uniqueName,
        publicUrl: publicUrlData.publicUrl,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error in /api/upload/sign:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
