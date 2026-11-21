/**
 * PRYORA Authentication & Authorization Engine
 * 
 * Secure password hashing using PBKDF2-SHA512 with cryptographically random salts.
 * Sessions with stable tokens and expiration dates.
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { queryOne, run } from './db/database.js';

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  currency: string;
  locale: string;
  date_format: string;
  onboarding_completed: number;
  created_at: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  token?: string;
}

export const MAX_PASSWORD_LENGTH = 128;
export const MIN_PASSWORD_LENGTH = 8;

export function validatePasswordStrength(password: string): string | null {
  if (!password || typeof password !== 'string') {
    return 'Password is required.';
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`;
  }
  return null;
}

/**
 * Generates a random salt and hashes password with PBKDF2.
 */
export function hashPassword(password: string): { salt: string; hash: string } {
  const safePassword = password.slice(0, MAX_PASSWORD_LENGTH);
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(safePassword, salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

/**
 * Verifies a password against the stored salt and hash using constant-time comparison.
 */
export function verifyPassword(password: string, salt: string, hash: string): boolean {
  if (!password || typeof password !== 'string' || password.length > MAX_PASSWORD_LENGTH) {
    return false;
  }
  if (!salt || !hash || salt === 'firebase_managed' || hash === 'firebase_managed') {
    return false;
  }
  try {
    const storedBuf = Buffer.from(hash, 'hex');
    const checkBuf = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512');
    if (storedBuf.length !== checkBuf.length) return false;
    return crypto.timingSafeEqual(storedBuf, checkBuf);
  } catch {
    return false;
  }
}

/**
 * Creates a new secure session token for a user.
 */
export function createSession(userId: string, durationDays: number = 30): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
  const createdAt = new Date().toISOString();

  // Opportunistically purge expired sessions for this user
  run(`DELETE FROM sessions WHERE user_id = ? AND expires_at < ?`, [userId, createdAt]);

  run(
    `INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
    [token, userId, expiresAt, createdAt]
  );

  return token;
}

export function revokeSession(token: string): void {
  if (!token) return;
  run(`DELETE FROM sessions WHERE token = ?`, [token]);
}

export function deleteUserSessions(userId: string): void {
  run(`DELETE FROM sessions WHERE user_id = ?`, [userId]);
}

/**
 * Validates a session token and returns the user if active.
 */
export function validateSession(token: string): AuthUser | null {
  if (!token || typeof token !== 'string' || token.length < 32 || token.length > 128) {
    return null;
  }

  const session = queryOne<{ user_id: string; expires_at: string }>(
    `SELECT user_id, expires_at FROM sessions WHERE token = ?`,
    [token]
  );

  if (!session) return null;

  if (new Date(session.expires_at) < new Date()) {
    // Session expired, remove it
    run(`DELETE FROM sessions WHERE token = ?`, [token]);
    return null;
  }

  const user = queryOne<AuthUser>(
    `SELECT id, email, display_name, currency, locale, date_format, onboarding_completed, created_at 
     FROM users WHERE id = ?`,
    [session.user_id]
  );

  return user;
}

export interface VerifiedFirebaseClaims {
  uid: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

const FIREBASE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let cachedCerts: Record<string, string> | null = null;
let cachedCertsExpiresAt = 0;

function base64UrlDecode(segment: string): Buffer {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4;
  const padded = pad ? normalized + '='.repeat(4 - pad) : normalized;
  return Buffer.from(padded, 'base64');
}

async function getFirebasePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedCerts && now < cachedCertsExpiresAt) {
    return cachedCerts;
  }

  const resp = await fetch(FIREBASE_CERTS_URL);
  if (!resp.ok) {
    throw new Error('Could not fetch Firebase signing certificates.');
  }
  const cacheControl = resp.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSec = maxAgeMatch ? Math.max(60, parseInt(maxAgeMatch[1], 10)) : 3600;

  const certs = (await resp.json()) as Record<string, string>;
  cachedCerts = certs;
  cachedCertsExpiresAt = now + maxAgeSec * 1000;
  return certs;
}

/**
 * Cryptographically verifies a Firebase Auth ID Token (RS256 JWT) against
 * Google's public x509 signing certificates and expected Firebase project ID.
 */
export async function verifyFirebaseIdToken(
  idToken: string,
  expectedProjectId: string
): Promise<VerifiedFirebaseClaims> {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Missing Firebase ID token.');
  }
  if (!expectedProjectId) {
    throw new Error('Firebase project ID is not configured.');
  }

  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed Firebase ID token.');
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  let header: { alg?: string; kid?: string };
  let payload: Record<string, any>;
  try {
    header = JSON.parse(base64UrlDecode(headerB64).toString('utf8'));
    payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8'));
  } catch {
    throw new Error('Invalid Firebase ID token encoding.');
  }

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Unsupported Firebase ID token signature algorithm.');
  }

  const certs = await getFirebasePublicCerts();
  const certPem = certs[header.kid];
  if (!certPem) {
    throw new Error('Unknown Firebase signing key.');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();

  const signatureBuf = base64UrlDecode(signatureB64);
  const signatureValid = verifier.verify(certPem, signatureBuf);
  if (!signatureValid) {
    throw new Error('Invalid Firebase ID token signature.');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const expectedIssuer = `https://securetoken.google.com/${expectedProjectId}`;

  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) {
    throw new Error('Firebase ID token has expired.');
  }
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) {
    throw new Error('Firebase ID token issued-at time is invalid.');
  }
  if (payload.aud !== expectedProjectId) {
    throw new Error('Firebase ID token audience mismatch.');
  }
  if (payload.iss !== expectedIssuer) {
    throw new Error('Firebase ID token issuer mismatch.');
  }
  if (typeof payload.sub !== 'string' || !payload.sub.trim() || payload.sub.length > 128) {
    throw new Error('Firebase ID token subject is invalid.');
  }
  if (typeof payload.email !== 'string' || !payload.email.includes('@')) {
    throw new Error('Firebase ID token does not contain a valid email.');
  }

  return {
    uid: payload.sub.trim(),
    email: payload.email.trim().toLowerCase(),
    emailVerified: Boolean(payload.email_verified),
    name: typeof payload.name === 'string' ? payload.name.trim() : undefined,
  };
}

/**
 * Express middleware to enforce authentication on protected endpoints.
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.cookies && req.cookies.pryora_session) {
    token = req.cookies.pryora_session;
  }

  if (!token) {
    res.status(401).json({
      error: 'Authentication required. Please sign in to access your financial data.',
      code: 'AUTH_REQUIRED',
    });
    return;
  }

  const user = validateSession(token);
  if (!user) {
    res.status(401).json({
      error: 'Your session has expired or is invalid. Please sign in again.',
      code: 'SESSION_EXPIRED',
    });
    return;
  }

  req.user = user;
  req.token = token;
  next();
}
