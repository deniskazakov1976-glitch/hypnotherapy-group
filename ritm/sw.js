/**
 * Мой ритм — Service Worker для PWA
 * Обеспечивает мгновенный запуск и автономную работу офлайн
 */

const CACHE_NAME = 'moy-ritm-v2.0.0';

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

// Установка Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker v2] Кэширование файлов приложения...');
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
});

// Активация и принудительное удаление всех старых кэшей
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[ServiceWorker v2] Удаление старого кэша:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Перехват сетевых запросов: Network-First для HTML и скриптов
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Внешние API запросы — напрямую в сеть
  if (url.origin !== self.location.origin && !url.href.includes('cdn.jsdelivr.net')) {
    return;
  }

  // Для навигации (HTML-страницы): СНАЧАЛА СЕТЬ (Network-First)
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Для остальных файлов: Network-First с фоллбэком на кэш
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
