import { api } from './api';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface PushStatus {
  isSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  isSubscribed: boolean;
  subscription: PushSubscription | null;
}

/**
 * Checks if Push Notifications and Service Workers are supported on current device
 */
export function isPushNotificationSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Gets current notification permission and active subscription
 */
export async function getPushSubscriptionState(): Promise<PushStatus> {
  if (!isPushNotificationSupported()) {
    return {
      isSupported: false,
      permission: 'unsupported',
      isSubscribed: false,
      subscription: null,
    };
  }

  const permission = Notification.permission;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return {
      isSupported: true,
      permission,
      isSubscribed: !!subscription,
      subscription,
    };
  } catch (err) {
    console.warn('Error checking push subscription:', err);
    return {
      isSupported: true,
      permission,
      isSubscribed: false,
      subscription: null,
    };
  }
}

/**
 * Requests permission, creates PushSubscription, and registers it with backend
 */
export async function subscribeToPushNotifications(userRole: string = 'all', userId?: string): Promise<{ success: boolean; message: string }> {
  if (!isPushNotificationSupported()) {
    return {
      success: false,
      message: 'Push notifications are not supported on this browser or device.',
    };
  }

  try {
    // 1. Request Notification Permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        success: false,
        message: 'Notification permission was denied. Please enable notifications in your browser/app settings.',
      };
    }

    // 2. Fetch VAPID Public Key from backend
    const { public_key } = await api.get('/push/vapid-public-key');
    if (!public_key) {
      throw new Error('VAPID public key not received from server');
    }

    // 3. Register push with Service Worker
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const applicationServerKey = urlBase64ToUint8Array(public_key);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    // 4. Send subscription keys to Backend DB
    const subJSON = subscription.toJSON();
    if (!subJSON.endpoint || !subJSON.keys?.p256dh || !subJSON.keys?.auth) {
      throw new Error('Invalid push subscription structure');
    }

    await api.post('/push/subscribe', {
      endpoint: subJSON.endpoint,
      keys: {
        p256dh: subJSON.keys.p256dh,
        auth: subJSON.keys.auth,
      },
      user_role: userRole || 'all',
      user_id: userId || null,
    });

    return {
      success: true,
      message: 'Background push notifications successfully activated!',
    };
  } catch (err: any) {
    console.error('Push subscription failed:', err);
    return {
      success: false,
      message: err?.message || 'Failed to activate push notifications.',
    };
  }
}

/**
 * Unsubscribes current device from push notifications
 */
export async function unsubscribeFromPushNotifications(): Promise<{ success: boolean; message: string }> {
  if (!isPushNotificationSupported()) {
    return { success: false, message: 'Push notifications not supported.' };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      try {
        await api.post('/push/unsubscribe', { endpoint });
      } catch (e) {
        // Non-critical if backend fails to delete
      }
    }
    return { success: true, message: 'Push notifications disabled.' };
  } catch (err: any) {
    console.error('Error unsubscribing:', err);
    return { success: false, message: err?.message || 'Failed to unsubscribe.' };
  }
}

/**
 * Dispatches a test notification from backend to verify background delivery
 */
export async function sendTestPushNotification(userRole: string = 'all'): Promise<{ success: boolean; message: string }> {
  try {
    await api.post('/push/test', {
      title: '🔔 Anbu Traders Test Notification',
      body: 'Background notifications are working smoothly on your phone!',
      url: '/#/notifications',
      role: userRole,
    });
    return {
      success: true,
      message: 'Test notification sent! Check your phone lock screen / notification shade.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to trigger test push notification.',
    };
  }
}
