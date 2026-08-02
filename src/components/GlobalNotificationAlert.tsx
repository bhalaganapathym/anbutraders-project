import { useEffect, useState, useRef } from 'react';
import { useRealtime } from '@/lib/useRealtime';
import { api, type Notification } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
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
        if (user.role === 'dispatch') return n.type === 'order_confirmed';
        if (user.role === 'billing') return n.type === 'dispatch_completed' || n.type === 'photo_uploaded' || n.type === 'billing_alert';
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
          
          // Play a simple beep sound if possible
          try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
            oscillator.connect(audioCtx.destination);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.1);
          } catch (e) {
            // ignore audio error
          }

          setTimeout(() => {
            setFlash(false);
          }, 4000);
        }
      } else {
        lastSeenIdRef.current = 'none'; // so we can detect when a new one arrives
      }
    } catch (e) {
      console.error('Failed to check notifications for alert', e);
    }
  };

  // Initial load
  useEffect(() => {
    checkNotifications();
  }, [user]);

  useRealtime('notifications', checkNotifications);

  if (!flash || !latestNotif) return null;

  return (
    <>
      {/* Screen flash effect */}
      <div className="pointer-events-none fixed inset-0 z-[100] animate-ping bg-amber-500/20" style={{ animationDuration: '1s' }} />
      
      {/* Prominent Alert */}
      <div className="fixed left-1/2 top-8 z-[110] w-[90%] max-w-md -translate-x-1/2 transform animate-bounce">
        <div className="flex items-start gap-4 rounded-xl border-2 border-amber-500 bg-white p-4 shadow-2xl">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <Bell size={24} className="animate-pulse" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-800">{latestNotif.title}</h3>
            <p className="mt-1 text-sm font-medium text-slate-600">{latestNotif.message}</p>
          </div>
        </div>
      </div>
    </>
  );
}
