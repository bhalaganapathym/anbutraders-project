import { useEffect, useState, useRef } from 'react';
import { useRealtime } from '@/lib/useRealtime';
import { api, type Notification } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { playNotificationChime, initAudioOnUserInteraction } from '@/lib/sound';
import { Bell, Volume2, X } from 'lucide-react';

// Module-level tracking persists across component unmounts & view changes
const globalKnownIds = new Set<string>();
let isGloballyInitialized = false;
const sessionStartTime = Date.now();

export default function GlobalNotificationAlert() {
  const { user } = useAuth();
  const [flash, setFlash] = useState(false);
  const [latestNotif, setLatestNotif] = useState<Notification | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkNotifications = async () => {
    if (!user) return;
    try {
      const data = await api.get('/notifications');
      const notifs = (data || []) as Notification[];
      
      const userRole = (user.role || '').toLowerCase();
      const myNotifs = notifs.filter(n => {
        const t = (n.type || '').toLowerCase();
        if (userRole === 'dispatch') {
          return t === 'order_confirmed' || 
                 t === 'advance_order_booked' || 
                 t === 'bill_generated' || 
                 t === 'ready_for_loading' ||
                 t === 'mismatch_approved' || 
                 t === 'mismatch_rejected' ||
                 t === 'weight_mismatch_decision';
        }
        if (userRole === 'billing' || userRole === 'cashier') {
          return t === 'dispatch_sent_to_billing' ||
                 t === 'ready_for_billing' ||
                 t === 'dispatch_completed' || 
                 t === 'vehicle_dispatched' ||
                 t === 'discount_approved' ||
                 t === 'discount_rejected' ||
                 t === 'today_payment_overdue' ||
                 t === 'credit_overdue' ||
                 t === 'billing_alert';
        }
        if (userRole === 'driver') {
          return t === 'bill_generated' || 
                 t === 'ready_for_loading' || 
                 t === 'dispatch_completed';
        }
        // Admin receives all operational alerts
        return true;
      });

      // Initial load: Record all existing notifications in memory so we never alert for past events
      if (!isGloballyInitialized) {
        myNotifs.forEach(n => globalKnownIds.add(n.id));
        isGloballyInitialized = true;
        return;
      }

      // Check for genuinely new notifications created during this active session
      const newUnread = myNotifs.filter(n => {
        if (globalKnownIds.has(n.id)) return false;
        if (n.read) return false;
        const createdTime = new Date(n.created_at).getTime();
        // Ignore notifications that were created before the app loaded
        if (createdTime < sessionStartTime) {
          globalKnownIds.add(n.id);
          return false;
        }
        return true;
      });
      
      // Update known IDs
      myNotifs.forEach(n => globalKnownIds.add(n.id));

      if (newUnread.length > 0) {
        const sorted = newUnread.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const newest = sorted[0];

        setLatestNotif(newest);
        setFlash(true);
        
        // Play distinct 3-second notification chime once
        playNotificationChime();

        if (dismissTimerRef.current) {
          clearTimeout(dismissTimerRef.current);
        }
        dismissTimerRef.current = setTimeout(() => {
          setFlash(false);
        }, 5000);
      }
    } catch (e) {
      console.error('Failed to check notifications for alert', e);
    }
  };

  // Initial load and user interaction audio unlock
  useEffect(() => {
    initAudioOnUserInteraction();
    checkNotifications();
  }, [user]);

  useRealtime('notifications', checkNotifications);

  if (!flash || !latestNotif) return null;

  return (
    <>
      {/* Screen flash effect */}
      <div className="pointer-events-none fixed inset-0 z-[100] animate-ping bg-amber-500/20" style={{ animationDuration: '1s' }} />
      
      {/* Prominent Floating Alert Banner */}
      <div className="fixed left-0 right-0 top-8 z-[110] flex justify-center px-4 pointer-events-none">
        <div className="pointer-events-auto flex items-start gap-3.5 rounded-2xl border-2 border-amber-500 bg-white dark:bg-slate-900 p-4 shadow-2xl animate-bounce max-w-md w-full">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400">
            <Bell size={22} className="animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white break-words">{latestNotif.title}</h3>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => playNotificationChime(true)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  title="Replay Sound"
                >
                  <Volume2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setFlash(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  title="Dismiss"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <p className="mt-0.5 text-xs font-medium text-slate-600 dark:text-slate-300 break-words">{latestNotif.message}</p>
          </div>
        </div>
      </div>
    </>
  );
}
