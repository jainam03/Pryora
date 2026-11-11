/**
 * PRYORA Frontend API Client
 */

import { safeGetItem, safeSetItem, safeRemoveItem } from './storage';

const TOKEN_KEY = 'pryora_auth_token';

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

const OFFLINE_CACHE_PREFIX = 'pryora_offline_api_';
const OFFLINE_QUEUE_KEY = 'pryora_offline_mutation_queue';

export interface QueuedOfflineMutation {
  id: string;
  endpoint: string;
  method: string;
  body?: string;
  label: string;
  createdAt: number;
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
  if (cleanPath.includes('/subscriptions')) {
    return method === 'DELETE' ? 'Remove subscription' : 'Save subscription';
  }
  if (cleanPath.includes('/goals')) {
    return method === 'DELETE' ? 'Remove goal' : 'Update goal';
  }
  return `${method} ${cleanPath.replace('/api/', '')}`;
}

export function getOfflineQueue(): QueuedOfflineMutation[] {
  const raw = safeGetItem(OFFLINE_QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
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
): QueuedOfflineMutation {
  const queue = getOfflineQueue();
  const item: QueuedOfflineMutation = {
    id: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    endpoint,
    method,
    body,
    label: describeMutation(method, endpoint),
    createdAt: Date.now(),
  };
  queue.push(item);
  saveOfflineQueue(queue);
  return item;
}

export function removeOfflineMutation(id: string): void {
  const queue = getOfflineQueue().filter((item) => item.id !== id);
  saveOfflineQueue(queue);
}

let isFlushingQueue = false;

export async function flushOfflineQueue(): Promise<{
  syncedCount: number;
  remainingCount: number;
}> {
  const queue = getOfflineQueue();
  if (queue.length === 0 || isFlushingQueue) {
    return { syncedCount: 0, remainingCount: queue.length };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { syncedCount: 0, remainingCount: queue.length };
  }

  isFlushingQueue = true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('pryora:offline-sync-state', { detail: { isSyncing: true } })
    );
  }

  const token = getStoredToken();
  const remaining: QueuedOfflineMutation[] = [];
  let syncedCount = 0;

  try {
    for (const item of queue) {
      try {
        const headers = new Headers({ 'Content-Type': 'application/json' });
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        const response = await fetch(item.endpoint, {
          method: item.method,
          headers,
          body: item.body,
        });

        if (response.ok || (response.status >= 400 && response.status < 500)) {
          // Succeeded or non-retryable client error
          syncedCount += 1;
        } else {
          remaining.push(item);
        }
      } catch {
        // Still offline or network interrupted; keep in queue
        remaining.push(item);
      }
    }

    saveOfflineQueue(remaining);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('pryora:offline-queue-flushed', {
          detail: { syncedCount, remainingCount: remaining.length },
        })
      );
    }

    return { syncedCount, remainingCount: remaining.length };
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
  if (endpoint.startsWith('/api/auth/') || endpoint.startsWith('/api/advisor/')) return false;
  return true;
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

    if (response.status === 401) {
      // Clear invalid session
      setStoredToken(null);
      window.dispatchEvent(new CustomEvent('pryora:unauthorized'));
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new ApiError(
        data.error || `Request failed with status ${response.status}. Your financial data is safe.`,
        response.status,
        data.code
      );
    }

    // Persist read-only GET snapshots for instant offline fallback
    if (method === 'GET' && endpoint.startsWith('/api/')) {
      try {
        safeSetItem(`${OFFLINE_CACHE_PREFIX}${endpoint}`, JSON.stringify(data));
      } catch {
        // Ignore storage quota limits for large payloads
      }
    }

    return data as T;
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err;
    }

    // If network request fails on a GET endpoint, fall back to cached offline snapshot
    if (method === 'GET' && endpoint.startsWith('/api/')) {
      const cachedRaw = safeGetItem(`${OFFLINE_CACHE_PREFIX}${endpoint}`);
      if (cachedRaw) {
        try {
          return JSON.parse(cachedRaw) as T;
        } catch {
          // Proceed to throw error if cache is corrupted
        }
      }
    }

    // If network request fails on a queueable mutation (e.g., adding a transaction while offline),
    // enqueue the action for automatic replay once connectivity is restored
    if (
      isQueueableEndpoint(method, endpoint) &&
      (typeof options.body === 'string' || options.body === undefined)
    ) {
      const queuedItem = enqueueOfflineMutation(
        endpoint,
        method,
        typeof options.body === 'string' ? options.body : undefined
      );
      return {
        ok: true,
        queuedOffline: true,
        offlineMutationId: queuedItem.id,
      } as unknown as T;
    }

    throw new ApiError(
      'Unable to connect to the PRYORA server. Please check your connection and try again.',
      0
    );
  }
}
