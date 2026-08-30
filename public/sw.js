// Standalone Service Worker for Web Push and Caching (Anbu Traders)

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Background Push Notification Listener
self.addEventListener('push', (event) => {
  let title = '🔔 Anbu Traders Alert';
  let body = 'New activity update in Anbu Traders';
  let url = '/';
  let tag = `anbu-${Date.now()}`;

  if (event.data) {
    try {
      const data = event.data.json();
      if (data.title) title = data.title;
      if (data.body) body = data.body;
      if (data.url) url = data.url;
      if (data.tag) tag = data.tag;
    } catch (e) {
      const text = event.data.text();
      if (text) body = text;
    }
  }

  const iconUrl = new URL('/pwa-192x192.png', self.location.origin).href;
  const options = {
    body,
    icon: iconUrl,
    badge: iconUrl,
    tag,
    renotify: true,
    silent: false,
    sound: '/alert-tone.mp3',
    data: { url },
    vibrate: [300, 100, 300, 100, 300],
    requireInteraction: true
  };

  // Broadcast to open browser windows to play foreground chime tone
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      client.postMessage({ type: 'PLAY_NOTIFICATION_CHIME', title, body });
    }
  });

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification Click Handler: Focus or open app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          if (client.url.includes(urlToOpen) || urlToOpen === '/') {
            return client.focus();
          }
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
