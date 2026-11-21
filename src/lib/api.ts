/**
 * PRYORA Frontend API Client
 *
 * Security & offline integrity:
 * - Scopes offline read-only cache and queued mutations strictly to the active userId
 * - Clears all cached user data and offline queue on logout or 401 unauthorized
 * - Sends Idempotency-Key headers when replaying queued offline mutations
 * - Excludes auth and destructive restore/reset endpoints from offline queueing
 */

import { safeGetItem, safeSetItem, safeRemoveItem } from './storage';

const TOKEN_KEY = 'pryora_auth_token';
const ACTIVE_USER_KEY = 'pryora_active_user_id';
const OFFLINE_CACHE_PREFIX = 'pryora_offline_api_';
const OFFLINE_QUEUE_KEY = 'pryora_offline_mutation_queue';

export function getStoredToken(): string | null {
  return safeGetItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    safeSetItem(TOKEN_KEY, token);
  } else {
    safeRemoveItem(TOKEN_KEY);
  }
}

export function getActiveApiUserId(): string | null {
  return safeGetItem(ACTIVE_USER_KEY);
}

export function setActiveApiUserId(userId: string | null): void {
  const previous = getActiveApiUserId();
  if (previous && userId && previous !== userId) {
    // User switched accounts in the same browser — purge prior user's offline data
    clearOfflineUserData();
  }
  if (userId) {
    safeSetItem(ACTIVE_USER_KEY, userId);
  } else {
    safeRemoveItem(ACTIVE_USER_KEY);
  }
}

/**
 * Purges all cached financial GET responses, pending offline mutations, and
 * any legacy Workbox API caches so no financial data lingers after sign-out.
 */
export function clearOfflineUserData(): void {
  safeRemoveItem(OFFLINE_QUEUE_KEY);
  safeRemoveItem(ACTIVE_USER_KEY);

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(OFFLINE_CACHE_PREFIX)) {
          keysToRemove.push(k);
        }
      }
      for (const k of keysToRemove) {
        window.localStorage.removeItem(k);
      }
    }
  } catch {
    // Ignore storage access restrictions
  }

  // Delete any legacy SW API cache if present
  try {
    if (typeof window !== 'undefined' && 'caches' in window) {
      window.caches.delete('pryora-api-ledger-cache').catch(() => {});
    }
  } catch {
    // Ignore
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('pryora:offline-queue-updated', {
        detail: { count: 0, queue: [] },
      })
    );
  }
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export interface QueuedOfflineMutation {
  id: string;
  userId: string;
  endpoint: string;
  method: string;
  body?: string;
  label: string;
  createdAt: number;
  retryCount?: number;
}

function describeMutation(method: string, endpoint: string): string {
  const cleanPath = endpoint.split('?')[0];
  if (cleanPath.includes('/transactions')) {
    if (method === 'POST') return 'Add transaction';
    if (method === 'PUT' || method === 'PATCH') return 'Update transaction';
    if (method === 'DELETE') return 'Delete transaction';
  }
  if (cleanPath.includes('/accounts')) {
    if (method === 'POST') return 'Create account';
    if (method === 'PUT' || method === 'PATCH') return 'Update account';
    if (method === 'DELETE') return 'Delete account';
  }
  if (cleanPath.includes('/budgets')) {
    return method === 'DELETE' ? 'Remove budget' : 'Save budget';
  }
  if (cleanPath.includes('/recurring')) {
    return method === 'DELETE' ? 'Remove recurring rule' : 'Save recurring rule';
  }
  if (cleanPath.includes('/goals')) {
    return method === 'DELETE' ? 'Remove goal' : 'Update goal';
  }
  return `${method} ${cleanPath.replace('/api/', '')}`;
}

export function getOfflineQueue(): QueuedOfflineMutation[] {
  const raw = safeGetItem(OFFLINE_QUEUE_KEY);
  if (!raw) return [];
  const activeUserId = getActiveApiUserId();
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    if (!activeUserId) return [];
    return parsed.filter((item: QueuedOfflineMutation) => item && item.userId === activeUserId);
  } catch {
    return [];
  }
}

export function getOfflineQueueCount(): number {
  return getOfflineQueue().length;
}

function saveOfflineQueue(queue: QueuedOfflineMutation[]): void {
  safeSetItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('pryora:offline-queue-updated', {
        detail: { count: queue.length, queue },
      })
    );
  }
}

export function enqueueOfflineMutation(
  endpoint: string,
  method: string,
  body?: string
): QueuedOfflineMutation | null {
  const userId = getActiveApiUserId();
  if (!userId) return null;

  const queue = getOfflineQueue();
  const item: QueuedOfflineMutation = {
    id: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    userId,
    endpoint,
    method,
    body,
    label: describeMutation(method, endpoint),
    createdAt: Date.now(),
    retryCount: 0,
  };
  queue.push(item);
  saveOfflineQueue(queue);
  return item;
}

export function removeOfflineMutation(id: string): void {
  const queue = getOfflineQueue().filter(item => item.id !== id);
  saveOfflineQueue(queue);
}

let isFlushingQueue = false;

export async function flushOfflineQueue(): Promise<{
  syncedCount: number;
  failedCount: number;
  remainingCount: number;
}> {
  const queue = getOfflineQueue();
  if (queue.length === 0 || isFlushingQueue) {
    return { syncedCount: 0, failedCount: 0, remainingCount: queue.length };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { syncedCount: 0, failedCount: 0, remainingCount: queue.length };
  }

  const token = getStoredToken();
  const activeUserId = getActiveApiUserId();
  if (!token || !activeUserId) {
    return { syncedCount: 0, failedCount: 0, remainingCount: 0 };
  }

  isFlushingQueue = true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('pryora:offline-sync-state', { detail: { isSyncing: true } })
    );
  }

  const remaining: QueuedOfflineMutation[] = [];
  let syncedCount = 0;
  let failedCount = 0;

  try {
    for (const item of queue) {
      if (item.userId !== activeUserId) {
        continue;
      }

      try {
        const headers = new Headers({
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': item.id,
        });

        const response = await fetch(item.endpoint, {
          method: item.method,
          headers,
          body: item.body,
        });

        if (response.ok) {
          syncedCount += 1;
        } else if (response.status === 401) {
          // Session expired — stop flushing and force re-auth
          clearOfflineUserData();
          setStoredToken(null);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('pryora:unauthorized'));
          }
          return { syncedCount, failedCount, remainingCount: 0 };
        } else if (response.status >= 400 && response.status < 500) {
          // Non-retryable validation/authorization error — drop and report failure
          failedCount += 1;
        } else {
          const nextRetries = (item.retryCount || 0) + 1;
          if (nextRetries <= 3) {
            remaining.push({ ...item, retryCount: nextRetries });
          } else {
            failedCount += 1;
          }
        }
      } catch {
        // Network still interrupted; keep in queue for next reconnect
        remaining.push(item);
      }
    }

    saveOfflineQueue(remaining);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('pryora:offline-queue-flushed', {
          detail: { syncedCount, failedCount, remainingCount: remaining.length },
        })
      );
    }

    return { syncedCount, failedCount, remainingCount: remaining.length };
  } finally {
    isFlushingQueue = false;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('pryora:offline-sync-state', { detail: { isSyncing: false } })
      );
    }
  }
}

function isQueueableEndpoint(method: string, endpoint: string): boolean {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return false;
  if (!endpoint.startsWith('/api/')) return false;
  if (
    endpoint.startsWith('/api/auth/') ||
    endpoint.startsWith('/api/data/restore') ||
    endpoint.startsWith('/api/data/clear-transactions') ||
    endpoint.startsWith('/api/categories/suggest')
  ) {
    return false;
  }
  return true;
}

function getScopedCacheKey(endpoint: string): string | null {
  const userId = getActiveApiUserId();
  if (!userId) return null;
  return `${OFFLINE_CACHE_PREFIX}${userId}_${endpoint}`;
}

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  const method = (options.method || 'GET').toUpperCase();

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    if (response.status === 401 && !endpoint.startsWith('/api/auth/login') && !endpoint.startsWith('/api/auth/register')) {
      setStoredToken(null);
      clearOfflineUserData();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pryora:unauthorized'));
      }
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new ApiError(
        data.error || `Request failed with status ${response.status}. Your financial data is safe.`,
        response.status,
        data.code
      );
    }

    // Persist user-scoped read-only GET snapshots for offline fallback (never cache /api/auth/*)
    if (method === 'GET' && endpoint.startsWith('/api/') && !endpoint.startsWith('/api/auth/')) {
      const cacheKey = getScopedCacheKey(endpoint);
      if (cacheKey) {
        try {
          safeSetItem(cacheKey, JSON.stringify(data));
        } catch {
          // Ignore storage quota limits
        }
      }
    }

    return data as T;
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err;
    }

    // Offline fallback: only serve snapshots scoped to the current authenticated user
    if (method === 'GET' && endpoint.startsWith('/api/') && !endpoint.startsWith('/api/auth/')) {
      const cacheKey = getScopedCacheKey(endpoint);
      const cachedRaw = cacheKey ? safeGetItem(cacheKey) : null;
      if (cachedRaw) {
        try {
          return JSON.parse(cachedRaw) as T;
        } catch {
          // Proceed to throw error if cache is corrupted
        }
      }
    }

    if (
      isQueueableEndpoint(method, endpoint) &&
      (typeof options.body === 'string' || options.body === undefined)
    ) {
      const queuedItem = enqueueOfflineMutation(
        endpoint,
        method,
        typeof options.body === 'string' ? options.body : undefined
      );
      if (queuedItem) {
        return {
          ok: true,
          queuedOffline: true,
          offlineMutationId: queuedItem.id,
        } as unknown as T;
      }
    }

    throw new ApiError(
      'Unable to connect to the PRYORA server. Please check your connection and try again.',
      0
    );
  }
}
