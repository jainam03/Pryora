/**
 * PRYORA Safe Storage Layer
 * 
 * Provides fail-safe storage access compatible with:
 * - Normal desktop & mobile browsers
 * - Sandboxed iframes (e.g. AI Studio preview, embed sandboxes)
 * - Environments where localStorage is disabled or throws SecurityError
 */

const memoryStore = new Map<string, string>();

function isLocalStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const testKey = '__pryora_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

const storageAvailable = isLocalStorageAvailable();

export function safeGetItem(key: string, defaultValue: string | null = null): string | null {
  try {
    if (storageAvailable) {
      const val = window.localStorage.getItem(key);
      return val !== null ? val : defaultValue;
    }
  } catch {
    // Fallback to memory
  }
  return memoryStore.has(key) ? memoryStore.get(key)! : defaultValue;
}

export function safeSetItem(key: string, value: string): void {
  try {
    if (storageAvailable) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Fallback to memory
  }
  memoryStore.set(key, value);
}

export function safeRemoveItem(key: string): void {
  try {
    if (storageAvailable) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Fallback to memory
  }
  memoryStore.delete(key);
}
