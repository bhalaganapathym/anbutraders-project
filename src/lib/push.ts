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
 * Guarantees that a Service Worker is registered and active
 */
export async function getOrRegisterServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Workers are not supported on this browser.');
  }

  let registration = await navigator.serviceWorker.getRegistration();
  if (!registration) {
    registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  }

  // Wait with a 3-second timeout for ready state so it never freezes
  try {
    const readyTimeout = new Promise<ServiceWorkerRegistration>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 3000)
    );
    return await Promise.race([navigator.serviceWorker.ready, readyTimeout]);
  } catch {
    return registration;
  }
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
    const registration = await getOrRegisterServiceWorker();
    const subscription = await registration.pushManager.getSubscription();
    return {
      isSupported: true,
      permission,
      isSubscribed: !!subscription,
      subscription,
    };
  } catch (err) {
    console.warn('Error checking push subscription state:', err);
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
export async function subscribeToPushNotifications(
  userRole: string = 'all',
  userId?: string
): Promise<{ success: boolean; message: string }> {
  if (!isPushNotificationSupported()) {
    return {
      success: false,
      message: 'Push notifications are not supported on this browser/mode. On iPhone, please tap Share -> Add to Home Screen first.',
    };
  }

  try {
    // 1. Request Notification Permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        success: false,
        message: 'Notification permission was denied. Please allow notifications in your site settings.',
      };
    }

    // 2. Fetch VAPID Public Key from backend
    const { public_key } = await api.get('/push/vapid-public-key');
    if (!public_key) {
      throw new Error('VAPID public key not received from server');
    }

    // 3. Register service worker and clear old subscription
    const registration = await getOrRegisterServiceWorker();
    const existingSub = await registration.pushManager.getSubscription();
    if (existingSub) {
      try {
        await existingSub.unsubscribe();
      } catch (e) {
        console.warn('Old subscription cleanup notice:', e);
      }
    }

    // 4. Create new browser push subscription
    const applicationServerKey = urlBase64ToUint8Array(public_key);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    // 5. Send subscription keys to Backend DB
    const subJSON = subscription.toJSON();
    if (!subJSON.endpoint || !subJSON.keys?.p256dh || !subJSON.keys?.auth) {
      throw new Error('Invalid push subscription structure received from browser.');
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

    // 6. Direct local test notification to give immediate user feedback
    try {
      await registration.showNotification('🔔 Push Notifications Activated', {
        body: 'Anbu Traders background alerts are now active on your device!',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'welcome-local',
        vibrate: [200, 100, 200],
      });
    } catch {
      // Local notification fallback
    }

    return {
      success: true,
      message: 'Background push notifications successfully activated!',
    };
  } catch (err: any) {
    console.error('Push subscription error:', err);
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
    const registration = await getOrRegisterServiceWorker();
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
      body: 'Background notifications are working smoothly on your device!',
      url: '/#/notifications',
      role: userRole,
    });
    return {
      success: true,
      message: 'Test notification sent from server! Check your lock screen / notification shade.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to trigger test push notification.',
    };
  }
}
