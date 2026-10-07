// Storvia Admin service worker. It exists only to make the app installable and
// to show an offline page. It NEVER caches data: the only cached file is
// /offline.html, and only page navigations are handled (network first; the
// offline page when the network fails). Every other request (API calls, JS,
// CSS, images, Clerk) is not intercepted and goes straight to the network.
const CACHE = "storvia-admin-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    fetch(event.request).catch(() => caches.open(CACHE).then((cache) => cache.match(OFFLINE_URL)))
  );
});
