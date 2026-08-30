import { useEffect, useState, useRef } from 'react';
import { useRealtime } from '@/lib/useRealtime';
import { api, type Notification } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { playNotificationChime, initAudioOnUserInteraction } from '@/lib/sound';
import { Bell } from 'lucide-react';

export default function GlobalNotificationAlert() {
  const { user } = useAuth();
  const [flash, setFlash] = useState(false);
  const [latestNotif, setLatestNotif] = useState<Notification | null>(null);
  
  // Track the most recent notification ID to avoid double-flashing
  const lastSeenIdRef = useRef<string | null>(null);

  const checkNotifications = async () => {
    if (!user) return;
    try {
      const data = await api.get('/notifications');
      const notifs = data as Notification[];
      
      const myNotifs = notifs.filter(n => {
        const t = (n.type || '').toLowerCase();
        if (user.role === 'dispatch') {
          return t === 'order_confirmed' || 
                 t === 'advance_order_booked' || 
                 t === 'bill_generated' || 
                 t === 'ready_for_loading' ||
                 t === 'mismatch_approved' || 
                 t === 'mismatch_rejected' ||
                 t === 'weight_mismatch_decision';
        }
        if (user.role === 'billing' || user.role === 'cashier') {
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
        // Admin receives all operational alerts
        return true;
      });

      if (myNotifs.length > 0) {
        // Sort by created_at desc
        const sorted = myNotifs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const newest = sorted[0];

        // If this is the first load, just set the id but don't flash
        if (lastSeenIdRef.current === null) {
          lastSeenIdRef.current = newest.id;
          return;
        }

        // If it's a new unread notification we haven't flashed for
        if (newest.id !== lastSeenIdRef.current && !newest.read) {
          lastSeenIdRef.current = newest.id;
          setLatestNotif(newest);
          setFlash(true);
          
          // Play distinct 3-tone notification chime
          playNotificationChime();

          setTimeout(() => {
            setFlash(false);
          }, 6000);
        }
      } else {
        lastSeenIdRef.current = 'none'; // so we can detect when a new one arrives
      }
    } catch (e) {
      console.error('Failed to check notifications for alert', e);
    }
  };

  // Initial load and user interaction audio unlock
  useEffect(() => {
    initAudioOnUserInteraction();
    checkNotifications();

    // Listen to background service worker chime triggers
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PLAY_NOTIFICATION_CHIME') {
        playNotificationChime();
        checkNotifications();
      }
    };
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    return () => {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, [user]);

  useRealtime('notifications', checkNotifications);

  if (!flash || !latestNotif) return null;

  return (
    <>
      {/* Screen flash effect */}
      <div className="pointer-events-none fixed inset-0 z-[100] animate-ping bg-amber-500/20" style={{ animationDuration: '1s' }} />
      
      {/* Prominent Alert */}
      <div className="fixed left-0 right-0 top-8 z-[110] flex justify-center px-4 pointer-events-none">
        <div className="w-full max-w-md pointer-events-auto">
          <div className="flex items-start gap-4 rounded-xl border-2 border-amber-500 bg-white p-4 shadow-2xl animate-bounce">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <Bell size={24} className="animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-slate-800 break-words">{latestNotif.title}</h3>
              <p className="mt-1 text-sm font-medium text-slate-600 break-words">{latestNotif.message}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
