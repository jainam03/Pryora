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

/**
 * Generates a random salt and hashes password with PBKDF2.
 */
export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

/**
 * Verifies a password against the stored salt and hash.
 */
export function verifyPassword(password: string, salt: string, hash: string): boolean {
  const checkHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(checkHash, 'hex'));
}

/**
 * Creates a new secure session token for a user.
 */
export function createSession(userId: string, durationDays: number = 30): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
  const createdAt = new Date().toISOString();

  run(
    `INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
    [token, userId, expiresAt, createdAt]
  );

  return token;
}

/**
 * Validates a session token and returns the user if active.
 */
export function validateSession(token: string): AuthUser | null {
  if (!token) return null;

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
