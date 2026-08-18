import { useCallback, useEffect, useState } from 'react';
import { useRealtime } from '@/lib/useRealtime';
import { api, type Notification } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import {
  Bell, CheckCircle2, Trash2, X, Truck, IndianRupee, Clock, Download
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

export default function Notifications() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (items: Notification[]) => {
    if (selectedIds.size === items.length && items.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} selected notification(s)?`)) return;
    try {
      await api.post('/notifications/bulk-delete', { ids: Array.from(selectedIds) });
      toast(`Deleted ${selectedIds.size} notification(s)`, 'success');
      setSelectedIds(new Set());
      load();
    } catch (e: any) {
      toast(e?.message || 'Failed to delete notifications', 'error');
    }
  };

  const handleClearAll = async () => {
    if (notifications.length === 0) return;
    if (!confirm('Are you sure you want to clear ALL notifications? This will free up Supabase storage.')) return;
    try {
      await api.delete('/notifications/clear-all');
      toast('All notifications cleared', 'success');
      setSelectedIds(new Set());
      load();
    } catch (e: any) {
      toast(e?.message || 'Failed to clear notifications', 'error');
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/notifications');
      
      const myNotifications = (data as Notification[]).filter(n => {
        if (user?.role === 'dispatch') return n.type === 'order_confirmed';
        if (user?.role === 'billing') return n.type === 'dispatch_completed' || n.type === 'photo_uploaded' || n.type === 'billing_alert';
        return true; // admin sees all
      });
      
      setNotifications(myNotifications);
    } catch {
      toast('Failed to load notifications', 'error');
    }
    setLoading(false);
  }, [toast, user]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime('notifications', load);

  const markRead = async (id: string) => {
    try {
      const n = notifications.find(x => x.id === id);
      if (n) await api.put(`/notifications/${id}`, { ...n, read: true });
      load();
    } catch {
      toast('Failed to mark as read', 'error');
    }
  };

  const markAllRead = async () => {
    try {
      const unread = notifications.filter(x => !x.read);
      await Promise.all(unread.map(n => api.put(`/notifications/${n.id}`, { ...n, read: true })));
      toast('All notifications marked as read', 'success');
      load();
    } catch {
      toast('Failed to mark all as read', 'error');
    }
  };

  const remove = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`);
      load();
    } catch {
      toast('Failed to delete notification', 'error');
    }
  };

  const deleteImage = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}/image`);
      toast('Image deleted from server', 'success');
      load();
    } catch {
      toast('Failed to delete image', 'error');
    }
  };

  const downloadImage = (url: string, title: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `dispatch_image_${title.replace(/\s+/g, '_')}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const filtered = filter === 'unread' ? notifications.filter((n) => !n.read) : notifications;
  const unreadCount = notifications.filter((n) => !n.read).length;
  
  const title = user?.role === 'dispatch' ? 'Dispatch Notifications' : 'Billing Notifications';
  const subtitle = user?.role === 'dispatch' 
    ? 'Alerts from the billing team when orders are ready' 
    : 'Alerts from the dispatch team when orders are ready for billing';

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-bold text-slate-800">
            {title}
            {unreadCount > 0 && (
              <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold text-white">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">{subtitle}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="btn-secondary text-xs py-1.5 px-3">
              <CheckCircle2 size={14} /> {t('mark_all_read')}
            </button>
          )}
          {notifications.length > 0 && (
            <button onClick={handleClearAll} className="btn-secondary text-rose-600 border-rose-200 hover:bg-rose-50 text-xs py-1.5 px-3">
              <Trash2 size={14} /> {t('clear_all_notifs')}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filter === 'all' ? 'bg-amber-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t('all')} ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filter === 'unread' ? 'bg-amber-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t('status_pending')} ({unreadCount})
          </button>
        </div>

        {filtered.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleSelectAll(filtered)}
              className="btn-secondary text-xs py-1 px-2.5"
            >
              {selectedIds.size === filtered.length ? 'Deselect All' : `Select All (${filtered.length})`}
            </button>
            {selectedIds.size > 0 && (
              <button
                onClick={handleBulkDelete}
                className="btn-danger text-xs py-1 px-2.5 flex items-center gap-1"
              >
                <Trash2 size={13} /> Delete ({selectedIds.size})
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading notifications...</p>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-10 sm:p-12 text-center">
          <Bell size={36} className="text-slate-300" />
          <p className="text-slate-500 text-sm">
            {filter === 'unread' ? 'No unread notifications.' : 'No notifications yet. Completed dispatches will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((n) => {
            const isSelected = selectedIds.has(n.id);
            return (
              <div
                key={n.id}
                className={`card p-3.5 sm:p-4 transition-all duration-150 relative ${
                  isSelected ? 'ring-2 ring-amber-500 bg-amber-50/20' : n.read ? 'opacity-70 bg-slate-50/60' : 'border-l-4 border-l-amber-500 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="pt-0.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(n.id)}
                      className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                  </div>

                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    n.read ? 'bg-slate-100 text-slate-400' : 'bg-amber-100 text-amber-700'
                  }`}>
                    <Truck size={18} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-800 text-sm break-words">{n.title}</p>
                        <p className="mt-0.5 text-xs sm:text-sm text-slate-600 break-words leading-relaxed">{n.message}</p>
                        
                        {n.image_url && (
                          <div className="mt-2.5">
                            <img src={n.image_url} alt="Attached" className="h-28 sm:h-36 w-auto max-w-full rounded-lg border border-slate-200 object-cover shadow-sm" />
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              <button onClick={() => downloadImage(n.image_url!, n.title)} className="btn-secondary text-xs px-2 py-1 h-auto flex items-center gap-1">
                                <Download size={13} /> Download
                              </button>
                              <button onClick={() => deleteImage(n.id)} className="btn-secondary text-rose-600 text-xs px-2 py-1 h-auto hover:bg-rose-50 border-rose-200 flex items-center gap-1">
                                <Trash2 size={13} /> Delete Photo
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {!n.read && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500 animate-pulse" />
                      )}
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 pt-2 border-t border-slate-100">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(n.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      
                      <div className="flex items-center gap-1">
                        {!n.read && (
                          <button
                            onClick={() => markRead(n.id)}
                            className="btn-ghost p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            title="Mark as read"
                          >
                            <CheckCircle2 size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => remove(n.id)}
                          className="btn-ghost p-1 text-rose-500 hover:bg-rose-50 rounded"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-fade-in border border-slate-700">
          <span className="text-xs font-semibold">
            {selectedIds.size} {selectedIds.size === 1 ? 'alert' : 'alerts'} selected
          </span>
          <button
            onClick={handleBulkDelete}
            className="btn-danger py-1 px-3 text-xs flex items-center gap-1 rounded-lg"
          >
            <Trash2 size={13} /> Delete Selected
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-slate-400 hover:text-white underline ml-1"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

