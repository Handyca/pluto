import { SignJWT, jwtVerify } from 'jose';
import { ParticipantSession } from '@/types';

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'fallback-secret-key'
);

/**
 * Create a JWT token for anonymous participant
 */
export async function createParticipantToken(
  sessionId: string,
  sessionCode: string,
  participantId: string,
  participantName: string,
  anonymousId: string
): Promise<string> {
  const token = await new SignJWT({
    sessionId,
    sessionCode,
    participantId,
    participantName,
    anonymousId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);

  return token;
}

/**
 * Verify and decode participant token
 */
export async function verifyParticipantToken(
  token: string
): Promise<ParticipantSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    return {
      sessionId: payload.sessionId as string,
      sessionCode: payload.sessionCode as string,
      participantId: payload.participantId as string,
      participantName: payload.participantName as string,
      anonymousId: payload.anonymousId as string,
    };
  } catch (error) {
    console.error('Failed to verify participant token:', error);
    return null;
  }
}

/**
 * Extract participant token from cookie or header
 */
export function extractParticipantToken(headers: Headers): string | null {
  // Try Authorization header first
  const authHeader = headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Try cookie
  const cookieHeader = headers.get('cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/participant_token=([^;]+)/);
    if (match) {
      return match[1];
    }
  }

  return null;
}
