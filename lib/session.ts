import { createHmac, timingSafeEqual } from 'crypto';

/**
 * HMAC-signed session token for long-lived browser sessions.
 *
 * Format: `{athleteId}.{epochSeconds}.{hmacHex}`
 *
 * The token is valid for SESSION_MAX_AGE_DAYS (default 30 days).
 * It is NOT encrypted — the athlete ID is visible — but it cannot
 * be forged without the server secret.
 */

const SECRET =
  process.env.SESSION_SECRET || process.env.STRAVA_CLIENT_SECRET || '';

/** Session cookie max-age in seconds (30 days). */
export const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60;

/** Create a signed session token for the given athlete. */
export function createSessionToken(athleteId: number): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = `${athleteId}.${timestamp}`;
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

/**
 * Verify a session token. Returns the athlete ID if valid, or null
 * if the token is invalid, expired, or tampered with.
 */
export function verifySessionToken(
  token: string
): { athleteId: number; timestamp: number } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [aidStr, tsStr, sig] = parts;
  const payload = `${aidStr}.${tsStr}`;
  const expectedSig = createHmac('sha256', SECRET)
    .update(payload)
    .digest('hex');

  // Timing-safe comparison to prevent timing attacks
  const sigBuf = Buffer.from(sig, 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

  const athleteId = Number(aidStr);
  const timestamp = Number(tsStr);
  if (isNaN(athleteId) || isNaN(timestamp)) return null;

  // Reject expired tokens
  const now = Math.floor(Date.now() / 1000);
  if (now - timestamp > SESSION_MAX_AGE_S) return null;

  return { athleteId, timestamp };
}
