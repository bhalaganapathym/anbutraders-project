import React, { useState, useEffect } from 'react';
import { 
  getQueuedRequests, 
  removeQueuedRequest, 
  clearAllQueuedRequests, 
  replayOfflineQueue, 
  subscribeQueueCount,
  type QueuedRequest 
} from '@/lib/offlineQueue';
import { CloudOff, RefreshCw, Trash2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

interface OfflineQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OfflineQueueModal({ isOpen, onClose }: OfflineQueueModalProps) {
  const [items, setItems] = useState<QueuedRequest[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const { t } = useTranslation();

  const loadItems = async () => {
    const list = await getQueuedRequests();
    setItems(list);
  };

  useEffect(() => {
    if (isOpen) {
      loadItems();
      setSyncStatus(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const unsubscribe = subscribeQueueCount(() => {
      loadItems();
    });
    return () => unsubscribe();
  }, []);

  if (!isOpen) return null;

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const result = await replayOfflineQueue();
      await loadItems();
      setSyncStatus(`Synced ${result.synced} item(s). ${result.failed > 0 ? `${result.failed} failed/remaining.` : ''}`);
    } catch (e: any) {
      setSyncStatus(`Sync error: ${e.message || 'Network unavailable'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRemove = async (id: string) => {
    await removeQueuedRequest(id);
    await loadItems();
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to clear all queued offline actions?')) {
      await clearAllQueuedRequests();
      await loadItems();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <CloudOff size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                Offline Outbox Queue
                {items.length > 0 && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500 text-white">
                    {items.length}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Actions saved while network was unavailable
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {syncStatus && (
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 text-xs flex items-center gap-2 border border-blue-200 dark:border-blue-900">
              <CheckCircle2 size={15} className="shrink-0" />
              <span>{syncStatus}</span>
            </div>
          )}

          {items.length === 0 ? (
            <div className="text-center py-10 text-slate-400 dark:text-slate-500">
              <CheckCircle2 size={40} className="mx-auto mb-2 text-emerald-500/80" />
              <p className="font-semibold text-sm text-slate-700 dark:text-slate-300">Outbox is clear</p>
              <p className="text-xs mt-1">All changes are synced with the live server.</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {item.method}
                    </span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {item.description || item.url.replace(/^.*\/api\/v1/, '')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Queued: {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </p>
                </div>
                <button
                  onClick={() => handleRemove(item.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 transition rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  title="Remove from queue"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        {items.length > 0 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between gap-2">
            <button
              onClick={handleClearAll}
              className="text-xs text-slate-500 hover:text-rose-600 font-medium transition px-2 py-1.5"
            >
              Clear All
            </button>
            <button
              onClick={handleSyncNow}
              disabled={isSyncing}
              className="btn-primary bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-2 px-4 py-2 rounded-xl shadow-xs transition disabled:opacity-50"
            >
              <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
