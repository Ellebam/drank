/* ============================================================
   Unsere Getränke – Service Worker
   Strategie:
   - HTML/CSS/JS/JSON: Netz zuerst, Cache als Offline-Fallback
     (Änderungen am Bestand sind sofort sichtbar)
   - Bilder & Fonts:   Cache zuerst, Aktualisierung im Hintergrund
   ============================================================ */
const VERSION = "drank-v1";

const PRECACHE = [
  "./",
  "index.html",
  "assets/css/styles.css",
  "assets/js/app.js",
  "data/beverages.json",
  "manifest.webmanifest",
  "assets/fonts/cormorant-garamond-var.woff2",
  "assets/fonts/inter-var.woff2",
  "assets/icons/icon-192.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION)
      // allSettled: ein fehlendes Asset darf die Installation nicht verhindern
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.destination === "image" || req.destination === "font") {
    event.respondWith(staleWhileRevalidate(req));
  } else {
    event.respondWith(networkFirst(req));
  }
});

async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(req);
  const fresh = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => undefined);
  return cached || (await fresh) || Response.error();
}

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req, { ignoreSearch: req.mode === "navigate" });
    if (cached) return cached;
    if (req.mode === "navigate") {
      const shell = (await cache.match("./")) || (await cache.match("index.html"));
      if (shell) return shell;
    }
    return Response.error();
  }
}
