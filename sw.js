const CACHE = 'kiroku-v2';
const FILES = ['./', 'index.html', 'style.css', 'logic.js', 'app.js', 'manifest.webmanifest', 'icon.png', 'taken.png', 'stamps/1.webp', 'stamps/1-s.webp', 'stamps/2.webp', 'stamps/2-s.webp', 'stamps/3.webp', 'stamps/3-s.webp', 'stamps/4.webp', 'stamps/4-s.webp', 'stamps/5.webp', 'stamps/5-s.webp', 'stamps/6.webp', 'stamps/6-s.webp', 'stamps/7.webp', 'stamps/7-s.webp', 'stamps/8.webp', 'stamps/8-s.webp', 'stamps/9.webp', 'stamps/9-s.webp'];
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); });
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
));
// ネットワーク優先、オフライン時だけ保存済みを使う（更新が反映されやすい）
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((res) => {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy));
    return res;
  }).catch(() => caches.match(e.request)));
});
