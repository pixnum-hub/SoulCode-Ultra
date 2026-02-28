// ═══════════════════════════════════════════════════════
// SoulCode Service Worker v6
// © Manik Roy 2026 — Offline-first PWA
// Updated: Subscription price updated to ₹999/month
// ═══════════════════════════════════════════════════════

const VERSION     = '6.0.0';
const CACHE_SHELL = 'soulcode-shell-v6';
const CACHE_CDN   = 'soulcode-cdn-v6';
const OLD_CACHES  = [
  'soulcode-v1', 'soulcode-v2',
  'soulcode-blob-v2',
  'soulcode-shell-v1', 'soulcode-shell-v2', 'soulcode-shell-v3', 'soulcode-shell-v4', 'soulcode-shell-v5',
  'soulcode-cdn-v1',   'soulcode-cdn-v2',   'soulcode-cdn-v3',   'soulcode-cdn-v4',   'soulcode-cdn-v5'
];

// Shell assets to pre-cache on install
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-96.png',
  './icon-152.png',
  './icon-192.png',
  './icon-512.png'
];

// CDN domains — cache-first strategy
const CDN_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdnjs.cloudflare.com'
];

// ── INSTALL: pre-cache shell
self.addEventListener('install', event => {
  console.log(`[SW v${VERSION}] Installing...`);
  event.waitUntil(
    caches.open(CACHE_SHELL)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => {
        console.log(`[SW v${VERSION}] Shell cached ✓`);
        return self.skipWaiting();
      })
      .catch(err => {
        console.warn('[SW] Pre-cache partial failure (OK in dev):', err.message);
        return self.skipWaiting();
      })
  );
});

// ── ACTIVATE: clean ALL old caches + claim clients
self.addEventListener('activate', event => {
  console.log(`[SW v${VERSION}] Activating...`);
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(k => k !== CACHE_SHELL && k !== CACHE_CDN)
            .map(k => {
              console.log(`[SW] Deleting old cache: ${k}`);
              return caches.delete(k);
            })
        )
      )
      .then(() => self.clients.claim())
      .then(() =>
        self.clients.matchAll({ type: 'window' }).then(clients =>
          clients.forEach(c => c.postMessage({ type: 'SW_ACTIVATED', version: VERSION }))
        )
      )
  );
});

// ── FETCH: routing strategy
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;
  if (!url.startsWith('http')) return;

  // CDN resources → cache-first
  if (CDN_HOSTS.some(h => url.includes(h))) {
    event.respondWith(cdnFirst(event.request));
    return;
  }

  // Shell assets → stale-while-revalidate
  event.respondWith(staleWhileRevalidate(event.request));
});

// Cache-first for CDN (fonts, libraries)
async function cdnFirst(request) {
  const cache  = await caches.open(CACHE_CDN);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return offlinePage();
  }
}

// Stale-while-revalidate for shell
async function staleWhileRevalidate(request) {
  const cache  = await caches.open(CACHE_SHELL);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached || fetchPromise || offlinePage();
}

// Offline fallback page
function offlinePage() {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SoulCode — Offline</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{
    background:#0f0c1a;color:#f0ecff;
    font-family:'Segoe UI',system-ui,sans-serif;
    display:flex;flex-direction:column;align-items:center;
    justify-content:center;min-height:100vh;text-align:center;padding:24px;
  }
  .star{font-size:48px;margin-bottom:20px;animation:spin 8s linear infinite;}
  @keyframes spin{to{transform:rotate(360deg);}}
  h1{font-size:28px;font-weight:900;background:linear-gradient(135deg,#b07fff,#7fd8ff);
    -webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:12px;}
  p{color:#a89ec4;font-size:15px;line-height:1.6;max-width:300px;margin-bottom:28px;}
  button{
    padding:14px 28px;border-radius:14px;border:none;
    background:linear-gradient(135deg,#b07fff,#7f50ff);
    color:#fff;font-size:15px;font-weight:700;cursor:pointer;
    box-shadow:0 4px 24px rgba(176,127,255,0.4);
  }
</style>
</head>
<body>
  <div class="star">✦</div>
  <h1>SoulCode</h1>
  <p>You appear to be offline. SoulCode will resume when your connection is restored.</p>
  <button onclick="location.reload()">Try Again</button>
</body>
</html>`,
    { status: 503, headers: { 'Content-Type': 'text/html;charset=utf-8' } }
  );
}

// ── PUSH NOTIFICATIONS
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title || 'SoulCode ✦', {
      body:     data.body    || 'Your numerology insight is ready.',
      icon:     './icon-192.png',
      badge:    './icon-96.png',
      vibrate:  [200, 80, 200, 80, 300],
      tag:      'soulcode-push',
      renotify: true,
      data:     { url: data.url || './index.html' },
      actions:  [
        { action: 'open',    title: '✦ Open SoulCode' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
      for (const w of ws) if ('focus' in w) return w.focus();
      return clients.openWindow(event.notification.data?.url || './');
    })
  );
});

// ── MESSAGE CHANNEL (version check, cache clear, skip waiting)
self.addEventListener('message', event => {
  const { type } = event.data || {};

  if (type === 'SKIP_WAITING') {
    console.log('[SW] SKIP_WAITING received — updating...');
    self.skipWaiting();
    return;
  }

  if (type === 'GET_VERSION') {
    event.source?.postMessage({ type: 'SW_VERSION', version: VERSION });
    return;
  }

  if (type === 'CLEAR_CACHE') {
    caches.delete(CACHE_SHELL).then(() =>
      event.source?.postMessage({ type: 'CACHE_CLEARED' })
    );
    return;
  }

  if (type === 'CLEAR_ALL_CACHES') {
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => event.source?.postMessage({ type: 'ALL_CACHES_CLEARED' }));
    return;
  }
});

console.log(`[SW v${VERSION}] SoulCode Service Worker loaded ✦`);