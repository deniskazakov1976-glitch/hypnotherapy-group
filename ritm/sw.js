/**
 * Мой ритм — Service Worker для PWA
 * Обеспечивает мгновенный запуск и автономную работу офлайн
 */

const CACHE_NAME = 'moy-ritm-v1.0.1';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/apple-touch-icon.png',
  './assets/favicon.png',
  './js/config.js',
  './js/storage.js',
  './js/auth-service.js',
  './js/ai-service.js',
  './js/chart-manager.js',
  './js/firebase-service.js',
  './js/app.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// Установка Service Worker и кэширование статических файлов
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Кэширование файлов приложения...');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Активация и удаление старых кэшей при обновлении
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[ServiceWorker] Удаление старого кэша:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Перехват сетевых запросов (Stale-while-revalidate для статики, Network-only для API)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Запросы к внешним API (например, anymodel.org) идут напрямую в сеть без кэширования
  if (url.origin !== self.location.origin && !url.href.includes('cdn.jsdelivr.net')) {
    return;
  }

  // Для локальных файлов приложения: отдаем из кэша, параллельно обновляя
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Фоновое обновление кэша
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => {/* офлайн */});

        return cachedResponse;
      }

      // Если в кэше нет — загружаем из сети
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      });
    }).catch(() => {
      // Фоллбэк на главную страницу при офлайн-запросе HTML
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
