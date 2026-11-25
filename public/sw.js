const CACHE_PREFIX = 'atelier-react-shell-';
const CACHE = `${CACHE_PREFIX}v5`;
const FILES = ['/', '/index.html', '/login', '/manifest.webmanifest', '/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));

async function serveAsset(request) {
  const cache = await caches.open(CACHE).catch(() => null);
  const cached = await cache?.match(request).catch(() => null);
  if (cached) return cached;

  const response = await fetch(request);
  const isHtml = response.headers.get('Content-Type')?.startsWith('text/html');
  if (isHtml && ['script', 'style'].includes(request.destination)) {
    return new Response(null, { status: 404 });
  }
  if (response.ok && !isHtml) {
    await cache?.put(request, response.clone()).catch(() => {});
  }
  return response;
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(async () => {
      const cache = await caches.open(CACHE);
      return await cache.match('/index.html') || Response.error();
    }));
    return;
  }
  event.respondWith(serveAsset(event.request));
});
