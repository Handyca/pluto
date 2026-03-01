/**
 * POST /api/upload/confirm
 *
 * Called after the client has successfully uploaded a file directly to
 * Supabase Storage via the signed URL from /api/upload/sign.
 * Creates the MediaAsset DB record and returns it.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyParticipantToken } from '@/lib/participant-auth';
import { getSupabaseServerClient } from '@/lib/supabase';
import { z } from 'zod';

const BodySchema = z.object({
  path: z.string().min(1).max(500),
  // publicUrl is intentionally NOT accepted from the client — it is derived
  // server-side from the path to prevent URL injection attacks.
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(128),
  size: z.number().int().positive(),
  type: z.enum(['image', 'video', 'sticker']),
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

    const { path, filename, mimeType, size, type, participantToken } = parsed.data;

    // Derive the public URL server-side — never trust the client-supplied value.
    const supabase = getSupabaseServerClient();
    const { data: publicUrlData } = supabase.storage.from('uploads').getPublicUrl(path);
    const publicUrl = publicUrlData.publicUrl;

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
    }

    // ── Validate path matches expected bucket structure ────────────────────
    const expectedPrefix = `${type}/`;
    if (!path.startsWith(expectedPrefix)) {
      return NextResponse.json({ success: false, error: 'Invalid storage path' }, { status: 400 });
    }

    // ── Create DB record ──────────────────────────────────────────────────
    const mediaAsset = await prisma.mediaAsset.create({
      data: {
        type: type === 'image' ? 'IMAGE' : type === 'video' ? 'VIDEO' : 'STICKER',
        url: publicUrl,
        filename,
        mimeType,
        size,
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
    console.error('Error in /api/upload/confirm:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
