import { useState, useEffect } from 'react';
import { Bell, BellOff, BellRing, Smartphone, CheckCircle, AlertCircle, RefreshCw, Send } from 'lucide-react';
import {
  isPushNotificationSupported,
  getPushSubscriptionState,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  sendTestPushNotification,
  type PushStatus
} from '@/lib/push';
import { useToast } from './Toast';
import { useAuth } from '@/context/AuthContext';

interface Props {
  variant?: 'banner' | 'card' | 'compact';
}

export default function PushNotificationManager({ variant = 'card' }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState<PushStatus>({
    isSupported: false,
    permission: 'default',
    isSubscribed: false,
    subscription: null,
  });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  const refreshState = async () => {
    const s = await getPushSubscriptionState();
    setStatus(s);
  };

  useEffect(() => {
    refreshState();
  }, []);

  const handleTogglePush = async () => {
    setLoading(true);
    try {
      if (status.isSubscribed) {
        const res = await unsubscribeFromPushNotifications();
        if (res.success) {
          toast('Push notifications disabled', 'info');
        } else {
          toast(res.message, 'error');
        }
      } else {
        const res = await subscribeToPushNotifications(user?.role || 'all', user?.id);
        if (res.success) {
          toast(res.message, 'success');
        } else {
          toast(res.message, 'error');
        }
      }
      await refreshState();
    } catch (err: any) {
      toast(err?.message || 'Action failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSendTest = async () => {
    setTesting(true);
    try {
      const res = await sendTestPushNotification(user?.role || 'all');
      if (res.success) {
        toast(res.message, 'success');
      } else {
        toast(res.message, 'error');
      }
    } catch (err: any) {
      toast('Failed to send test push', 'error');
    } finally {
      setTesting(false);
    }
  };

  if (!status.isSupported) {
    if (variant === 'compact') return null;
    return (
      <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-3">
        <Smartphone size={20} className="shrink-0 text-amber-600" />
        <div>
          <p className="font-bold">Background Push Notifications</p>
          <p className="text-amber-700 dark:text-amber-400 mt-0.5">
            To receive notifications on your lock screen when outside the app on iPhone, tap <strong>Share → Add to Home Screen</strong>.
          </p>
        </div>
      </div>
    );
  }

  if (variant === 'banner') {
    return (
      <div className="p-4 rounded-2xl border-2 border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/80 via-blue-50/40 to-white dark:from-indigo-950/40 dark:via-slate-900 dark:to-slate-900 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
            status.isSubscribed
              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20 animate-bounce'
          }`}>
            {status.isSubscribed ? <BellRing size={22} /> : <Bell size={22} />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-black text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                {status.isSubscribed ? 'Mobile Push Notifications Active' : 'Enable Mobile Lock Screen Notifications'}
              </h4>
              <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                status.isSubscribed
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                  : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300'
              }`}>
                {status.isSubscribed ? 'Delivering when closed' : 'PWA Ready'}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {status.isSubscribed
                ? 'Your device receives alerts for dispatches, bills, today payment dues, and approvals even when outside the app.'
                : 'Get instant alerts on your phone lock screen for dispatches, billing approvals, and overdue payments.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {status.isSubscribed && (
            <button
              type="button"
              onClick={handleSendTest}
              disabled={testing}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 flex items-center gap-1.5 transition"
              title="Test lock screen notification"
            >
              {testing ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
              Test Notification
            </button>
          )}
          <button
            type="button"
            onClick={handleTogglePush}
            disabled={loading}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-sm active:scale-95 ${
              status.isSubscribed
                ? 'bg-slate-200 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-950/50 text-slate-700 dark:text-slate-300 hover:text-rose-700 dark:hover:text-rose-400'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
            }`}
          >
            {loading && <RefreshCw size={13} className="animate-spin" />}
            {status.isSubscribed ? (
              <>
                <BellOff size={14} /> Turn Off
              </>
            ) : (
              <>
                <Bell size={14} /> 🔔 Enable Notifications
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Card Variant (for Settings)
  return (
    <div className="card p-5 space-y-4 border-2 border-indigo-100 dark:border-indigo-900/40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <BellRing size={20} />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">
              Mobile Background Push Notifications
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Web Push protocol for delivery to Android & iOS lock screens when the PWA is closed
            </p>
          </div>
        </div>
        <span className={`badge text-xs font-bold ${
          status.isSubscribed
            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
        }`}>
          {status.isSubscribed ? 'Active' : 'Disabled'}
        </span>
      </div>

      <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs space-y-2 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          {status.isSubscribed ? (
            <CheckCircle size={15} className="text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle size={15} className="text-amber-600 shrink-0" />
          )}
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {status.isSubscribed
              ? 'This device is registered to receive background push notifications.'
              : 'This device is not currently receiving push notifications when the app is closed.'}
          </span>
        </div>
        <ul className="text-slate-500 dark:text-slate-400 space-y-1 list-disc pl-5">
          <li>⚠️ Unpaid Today Payment alerts at 6:00 PM cutoff</li>
          <li>🎁 Discount approval requests (Admin) and decisions (Billing)</li>
          <li>🎙️ Weight mismatch voice notes and approval notifications</li>
          <li>🚚 New dispatch bookings & confirmed customer deliveries</li>
        </ul>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={handleTogglePush}
          disabled={loading}
          className={`btn flex-1 flex items-center justify-center gap-2 font-bold py-2.5 ${
            status.isSubscribed
              ? 'bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900'
              : 'btn-primary bg-indigo-600 hover:bg-indigo-700 text-white'
          }`}
        >
          {loading ? (
            <RefreshCw size={15} className="animate-spin" />
          ) : status.isSubscribed ? (
            <BellOff size={15} />
          ) : (
            <Bell size={15} />
          )}
          {status.isSubscribed ? 'Disable Push Notifications' : 'Enable Mobile Push Notifications'}
        </button>

        {status.isSubscribed && (
          <button
            type="button"
            onClick={handleSendTest}
            disabled={testing}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 flex items-center gap-1.5 transition shrink-0"
          >
            {testing ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
            Test Push
          </button>
        )}
      </div>
    </div>
  );
}
