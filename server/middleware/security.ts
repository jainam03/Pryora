/**
 * PRYORA Security Middleware
 *
 * Provides:
 * - HTTP security headers (iframe-compatible; no X-Frame-Options: DENY)
 * - Strict no-store cache headers for authenticated financial APIs
 * - Origin validation for API requests
 * - Sliding-window in-memory rate limiting for authentication & sensitive routes
 * - Idempotency key deduplication helper for offline queue replays
 * - Centralized error sanitizer
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Security headers applied to all responses, plus strict no-store caching on /api/*
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  if (isHttps) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
}

/**
 * Conservative CORS middleware for API endpoints.
 * Permits same-origin requests and explicitly trusted deployment origins only.
 */
export function apiCors(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  if (!origin) {
    next();
    return;
  }

  const host = req.headers.host || '';
  const allowedExtra = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  let isAllowed = false;
  try {
    const parsed = new URL(origin);
    if (
      parsed.host === host ||
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      allowedExtra.includes(origin) ||
      (process.env.APP_URL && origin === process.env.APP_URL)
    ) {
      isAllowed = true;
    }
  } catch {
    isAllowed = false;
  }

  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');
  }

  if (req.method === 'OPTIONS') {
    res.status(isAllowed ? 204 : 403).end();
    return;
  }

  next();
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix: string;
  message?: string;
}

const rateBuckets = new Map<string, number[]>();

export function resetRateLimits(): void {
  rateBuckets.clear();
}

/**
 * Sliding-window rate limiter keyed by client IP + route prefix.
 */
export function createRateLimiter(options: RateLimitOptions) {
  const { windowMs, max, keyPrefix, message } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const forwarded = req.headers['x-forwarded-for'];
    const clientIp =
      (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim()) ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown';

    const key = `${keyPrefix}:${clientIp}`;
    const timestamps = (rateBuckets.get(key) || []).filter(ts => now - ts < windowMs);

    if (timestamps.length >= max) {
      const oldest = timestamps[0];
      const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: message || 'Too many requests. Please wait a moment and try again.',
        code: 'RATE_LIMITED',
      });
      return;
    }

    timestamps.push(now);
    rateBuckets.set(key, timestamps);

    // Opportunistic cleanup to keep memory bounded
    if (rateBuckets.size > 5000) {
      for (const [k, list] of rateBuckets.entries()) {
        if (list.every(ts => now - ts >= windowMs)) {
          rateBuckets.delete(k);
        }
      }
    }

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - timestamps.length)));
    next();
  };
}

/**
 * Short-lived Idempotency-Key cache for offline mutation replay deduplication.
 * Scoped strictly per authenticated user + endpoint + key.
 */
interface CachedIdempotencyResult {
  status: number;
  body: any;
  expiresAt: number;
}

const idempotencyCache = new Map<string, CachedIdempotencyResult>();
const IDEMPOTENCY_TTL_MS = 15 * 60 * 1000;

export function getIdempotentResponse(
  userId: string,
  scope: string,
  key?: string | string[]
): CachedIdempotencyResult | null {
  if (!key || typeof key !== 'string' || key.trim().length < 8 || key.length > 128) {
    return null;
  }
  const cacheKey = `${userId}:${scope}:${key.trim()}`;
  const entry = idempotencyCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    idempotencyCache.delete(cacheKey);
    return null;
  }
  return entry;
}

export function setIdempotentResponse(
  userId: string,
  scope: string,
  key: string | string[] | undefined,
  status: number,
  body: any
): void {
  if (!key || typeof key !== 'string' || key.trim().length < 8 || key.length > 128) {
    return;
  }
  const now = Date.now();
  if (idempotencyCache.size > 2000) {
    for (const [k, v] of idempotencyCache.entries()) {
      if (now > v.expiresAt) idempotencyCache.delete(k);
    }
  }
  const cacheKey = `${userId}:${scope}:${key.trim()}`;
  idempotencyCache.set(cacheKey, {
    status,
    body,
    expiresAt: now + IDEMPOTENCY_TTL_MS,
  });
}

/**
 * Centralized error handler that prevents leaking internal error messages or stack traces.
 */
export function safeErrorHandler(err: any, _req: Request, res: Response, _next: NextFunction): void {
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: 'Uploaded payload exceeds the maximum allowed size.' });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON request body.' });
    return;
  }

  console.error('Unhandled API error:', err?.message || err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'An unexpected server error occurred. Please try again.' });
  }
}
