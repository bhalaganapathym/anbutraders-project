import { useCallback, useEffect, useState } from 'react';
import { useRealtime } from '@/lib/useRealtime';
import { api, type Notification } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import {
  Bell, CheckCircle2, Trash2, X, Truck, IndianRupee, Clock,
} from 'lucide-react';

export default function Notifications() {
  const { user } = useAuth();
  const toast = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/notifications');
      
      // Filter notifications based on role if needed (though backend might already filter them)
      // For now, dispatch team only cares about 'order_confirmed' and billing cares about 'dispatch_completed'
      const myNotifications = (data as Notification[]).filter(n => {
        if (user?.role === 'dispatch') return n.type === 'order_confirmed';
        if (user?.role === 'billing') return n.type === 'dispatch_completed';
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

  const filtered = filter === 'unread' ? notifications.filter((n) => !n.read) : notifications;
  const unreadCount = notifications.filter((n) => !n.read).length;
  
  const title = user?.role === 'dispatch' ? 'Dispatch Notifications' : 'Billing Notifications';
  const subtitle = user?.role === 'dispatch' 
    ? 'Alerts from the billing team when orders are ready' 
    : 'Alerts from the dispatch team when orders are ready for billing';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
            {title}
            {unreadCount > 0 && (
              <span className="rounded-full bg-rose-500 px-2 py-0.5 text-sm font-bold text-white">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn-secondary">
            <CheckCircle2 size={15} /> Mark all as read
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            filter === 'all' ? 'bg-amber-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            filter === 'unread' ? 'bg-amber-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <Bell size={36} className="text-slate-300" />
          <p className="text-slate-500">
            {filter === 'unread' ? 'No unread notifications.' : 'No notifications yet. Completed dispatches will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((n) => (
            <div
              key={n.id}
              className={`card flex items-start gap-3 p-4 transition ${
                n.read ? 'opacity-60' : 'border-l-4 border-l-amber-500'
              }`}
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                n.read ? 'bg-slate-100 text-slate-400' : 'bg-amber-50 text-amber-600'
              }`}>
                <Truck size={20} />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-800">{n.title}</p>
                    <p className="mt-0.5 text-sm text-slate-600">{n.message}</p>
                  </div>
                  {!n.read && (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                  )}
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                  {n.customer_name && (
                    <span className="flex items-center gap-1">
                      <IndianRupee size={12} />
                      {n.customer_name}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                {!n.read && (
                  <button
                    onClick={() => markRead(n.id)}
                    className="btn-ghost p-1.5 text-emerald-600 hover:bg-emerald-50"
                    title="Mark as read"
                  >
                    <CheckCircle2 size={16} />
                  </button>
                )}
                <button
                  onClick={() => remove(n.id)}
                  className="btn-ghost p-1.5 text-rose-500 hover:bg-rose-50"
                  title="Delete"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
