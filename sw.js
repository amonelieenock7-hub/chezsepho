// Service worker CHEZSEPHO : réseau d'abord, copie en secours si pas de connexion.
// Les appels à Supabase, Wave, WhatsApp et Google Fonts ne sont jamais mis en cache.
const CACHE = 'chezsepho-v1';
const COEUR = [
    'index.html', 'panier.html', 'detail.html', 'reservation.html', 'paiement.html',
    'app.js', 'supabase-config.js', 'style.css', 'manifest.webmanifest',
    'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE)
            .then(c => Promise.all(COEUR.map(u => c.add(u).catch(() => {}))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    const req = e.request;
    const url = new URL(req.url);

    if (req.method !== 'GET' || url.origin !== self.location.origin) return;

    e.respondWith(
        fetch(req)
            .then(res => {
                if (res.ok) {
                    const copie = res.clone();
                    caches.open(CACHE).then(c => c.put(req, copie));
                }
                return res;
            })
            .catch(() => caches.match(req).then(r => r || caches.match('index.html')))
    );
});
