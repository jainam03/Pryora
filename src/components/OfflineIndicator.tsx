import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw, X, Clock, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  getOfflineQueue,
  flushOfflineQueue,
  removeOfflineMutation,
  QueuedOfflineMutation,
} from '../lib/api';

interface OfflineIndicatorProps {
  onRetrySync?: () => void;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ onRetrySync }) => {
  const { isOnline, justReconnected } = useOnlineStatus();
  const [dismissedOffline, setDismissedOffline] = useState<boolean>(false);
  const [queue, setQueue] = useState<QueuedOfflineMutation[]>(() => getOfflineQueue());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedCount, setLastSyncedCount] = useState<number>(0);
  const [showQueueDetails, setShowQueueDetails] = useState<boolean>(false);

  const pendingCount = queue.length;

  // Listen for offline queue updates, sync state changes, and flush events
  useEffect(() => {
    const handleQueueUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ count: number; queue: QueuedOfflineMutation[] }>;
      const updatedQueue = customEvent.detail?.queue ?? getOfflineQueue();
      setQueue(updatedQueue);
      // Re-surface banner if user performs a new offline action while previously dismissed
      if (updatedQueue.length > 0) {
        setDismissedOffline(false);
      } else {
        setShowQueueDetails(false);
      }
    };

    const handleSyncState = (e: Event) => {
      const customEvent = e as CustomEvent<{ isSyncing: boolean }>;
      setIsSyncing(Boolean(customEvent.detail?.isSyncing));
    };

    const handleQueueFlushed = (e: Event) => {
      const customEvent = e as CustomEvent<{ syncedCount: number; remainingCount: number }>;
      if (customEvent.detail?.syncedCount) {
        setLastSyncedCount(customEvent.detail.syncedCount);
      }
      setQueue(getOfflineQueue());
    };

    window.addEventListener('pryora:offline-queue-updated', handleQueueUpdated);
    window.addEventListener('pryora:offline-sync-state', handleSyncState);
    window.addEventListener('pryora:offline-queue-flushed', handleQueueFlushed);

    return () => {
      window.removeEventListener('pryora:offline-queue-updated', handleQueueUpdated);
      window.removeEventListener('pryora:offline-sync-state', handleSyncState);
      window.removeEventListener('pryora:offline-queue-flushed', handleQueueFlushed);
    };
  }, []);

  // Reset manual dismissal when connectivity state changes
  useEffect(() => {
    if (isOnline) {
      setDismissedOffline(false);
      setShowQueueDetails(false);
    } else {
      setLastSyncedCount(0);
    }
  }, [isOnline]);

  const handleManualSync = async () => {
    if (pendingCount > 0 && navigator.onLine) {
      await flushOfflineQueue();
    }
    if (onRetrySync) {
      onRetrySync();
    }
  };

  const shouldRenderOnlineBanner = isOnline && (justReconnected || isSyncing || pendingCount > 0);

  if (isOnline && !shouldRenderOnlineBanner) {
    return null;
  }

  if (!isOnline && dismissedOffline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 lg:bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-lg pointer-events-none"
    >
      {!isOnline ? (
        <div className="pointer-events-auto flex flex-col rounded-2xl bg-amber-500 text-slate-950 shadow-xl border border-amber-400 overflow-hidden">
          {/* Expandable Pending Queue Drawer */}
          {showQueueDetails && pendingCount > 0 && (
            <div className="bg-slate-950/95 text-slate-100 px-4 py-3 border-b border-amber-500/30 max-h-48 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  Pending Sync Queue ({pendingCount})
                </span>
                <span className="text-[11px] text-slate-400">
                  Auto-syncs when online
                </span>
              </div>
              <ul className="space-y-1.5">
                {queue.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-2 text-xs bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="font-medium text-slate-200 truncate">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-slate-400 tabular-nums">
                        {new Date(item.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeOfflineMutation(item.id)}
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
                        title="Discard queued action"
                        aria-label={`Discard ${item.label}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Main Offline Status Bar */}
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs font-semibold">
            <div className="flex items-center gap-2.5 min-w-0">
              <WifiOff className="w-4 h-4 shrink-0 stroke-[2.2]" />
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
                <span className="truncate font-bold">Offline Mode</span>
                <span className="hidden sm:inline text-slate-900/75">—</span>
                <span className="text-slate-950/90 truncate">
                  {pendingCount > 0 ? (
                    <span className="tabular-nums font-bold">
                      {pendingCount} {pendingCount === 1 ? 'action' : 'actions'} awaiting sync
                    </span>
                  ) : (
                    'Viewing cached ledger'
                  )}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Pending Queue Counter Badge */}
              <button
                type="button"
                onClick={() => {
                  if (pendingCount > 0) {
                    setShowQueueDetails((prev) => !prev);
                  }
                }}
                disabled={pendingCount === 0}
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold tabular-nums transition-colors ${
                  pendingCount > 0
                    ? 'bg-slate-950 text-amber-400 hover:bg-slate-900 cursor-pointer shadow-sm'
                    : 'bg-amber-600/25 text-slate-950/80 cursor-default'
                }`}
                title={
                  pendingCount > 0
                    ? 'View local actions awaiting network sync'
                    : 'No local actions queued'
                }
                aria-label={`${pendingCount} pending offline actions`}
              >
                <Clock className="w-3 h-3 shrink-0" />
                <span>{pendingCount} pending</span>
                {pendingCount > 0 &&
                  (showQueueDetails ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronUp className="w-3 h-3" />
                  ))}
              </button>

              {onRetrySync && (
                <button
                  type="button"
                  onClick={handleManualSync}
                  className="p-1.5 rounded-lg hover:bg-amber-600/30 transition-colors"
                  title="Retry connection & sync"
                  aria-label="Retry connection and sync"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                </button>
              )}

              <button
                type="button"
                onClick={() => setDismissedOffline(true)}
                className="p-1.5 rounded-lg hover:bg-amber-600/30 transition-colors"
                title="Dismiss banner"
                aria-label="Dismiss offline banner"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-2xl bg-emerald-500 text-slate-950 px-4 py-2.5 text-xs font-bold shadow-xl border border-emerald-400">
          <div className="flex items-center gap-2 min-w-0">
            <Wifi className="w-4 h-4 shrink-0 stroke-[2.2]" />
            <span className="truncate">
              {isSyncing && pendingCount > 0 ? (
                <span className="tabular-nums">
                  Back Online — Syncing {pendingCount} queued{' '}
                  {pendingCount === 1 ? 'action' : 'actions'}...
                </span>
              ) : pendingCount > 0 ? (
                <span className="tabular-nums">
                  Online — {pendingCount} pending {pendingCount === 1 ? 'action' : 'actions'} ready to
                  sync
                </span>
              ) : lastSyncedCount > 0 ? (
                <span className="tabular-nums">
                  Back Online — Synced {lastSyncedCount} queued{' '}
                  {lastSyncedCount === 1 ? 'action' : 'actions'}
                </span>
              ) : (
                'Back Online — Syncing ledger'
              )}
            </span>
          </div>

          {pendingCount > 0 && (
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 text-emerald-400 px-2.5 py-1 text-[11px] font-bold tabular-nums hover:bg-slate-900 transition-colors shrink-0"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Sync Now ({pendingCount})</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
