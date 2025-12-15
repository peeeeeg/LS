// Service Worker for Lifestream PWA

// 缓存名称和版本号
const CACHE_NAME = 'lifestream-cache-v1';

// 需要缓存的静态资源列表
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/ChatGPT Image 2025年12月16日 00_25_51.png',
  // 添加其他需要缓存的静态资源
];

// 安装事件：缓存初始资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// 激活事件：清理旧版本缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 拦截请求：优先从缓存获取，否则网络请求
self.addEventListener('fetch', (event) => {
  // 对API请求使用网络优先策略
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // API请求失败时可以返回离线数据或错误信息
          return new Response(JSON.stringify({ error: '网络连接不可用' }), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
  } else {
    // 对静态资源使用缓存优先策略
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          return response || fetch(event.request)
            .then((networkResponse) => {
              // 将新的响应添加到缓存
              return caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, networkResponse.clone());
                  return networkResponse;
                });
            });
        })
    );
  }
});

// 推送通知事件（可选）
self.addEventListener('push', (event) => {
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/ChatGPT Image 2025年12月16日 00_25_51.png',
    badge: '/ChatGPT Image 2025年12月16日 00_25_51.png',
    data: {
      url: data.url
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 点击通知事件（可选）
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});