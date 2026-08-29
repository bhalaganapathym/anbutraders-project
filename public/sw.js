// Standalone Service Worker for Web Push and Caching (Anbu Traders)

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Background Push Notification Listener
self.addEventListener('push', (event) => {
  let data = { title: 'Anbu Traders Alert', body: 'New notification', url: '/' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Anbu Traders Alert', body: event.data.text(), url: '/' };
    }
  }

  const title = data.title || 'Anbu Traders';
  const options = {
    body: data.body || '',
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    tag: data.tag || ('anbu-' + Date.now()),
    data: {
      url: data.url || '/'
    },
    vibrate: [300, 100, 300, 100, 300],
    requireInteraction: true
  };

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
