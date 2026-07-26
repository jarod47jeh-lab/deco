// Service worker : l'app fonctionne sans connexion une fois ouverte une première fois.

const CACHE = 'darija-v6';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/app.js',
  './js/data.js',
  './js/store.js',
  './js/audio.js',
  './js/games.js',
  './js/dom.js',
  './js/zip.js',
  './js/speech.js',
  './js/stories.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache d'abord pour rester instantané et fonctionner sans réseau, mais on
// revalide en arrière-plan : sans ça, une modification de js/data.js ne serait
// jamais servie à un téléphone où l'app est déjà installée. La nouvelle version
// est donc en place à l'ouverture suivante.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);

    const fetching = fetch(req)
      .then((res) => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      })
      .catch(() => null);

    e.waitUntil(fetching); // la mise à jour finit même si la réponse est déjà rendue
    return cached || (await fetching) || (await cache.match('./index.html'));
  })());
});
