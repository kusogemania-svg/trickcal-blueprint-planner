const CACHE_VERSION = "trickcal-blueprint-v4";
const BLUEPRINT_ICON_CODES = Array.from({ length: 8 }, (_, rankIndex) =>
  Array.from({ length: 7 }, (_, categoryIndex) => `${rankIndex + 2}${categoryIndex + 1}`),
).flat();
const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./data/initial-data.js",
  "./src/app.js",
  "./src/styles.css",
  "./src/optimizer.worker.js",
  "./src/core/backup.js",
  "./src/core/catalog.js",
  "./src/core/migrations.js",
  "./src/core/optimizer.js",
  "./src/core/storage.js",
  "./src/core/validator.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  ...BLUEPRINT_ICON_CODES.map((code) => `./blueprint-icons/${code}.webp`),
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === "opaque") return response;
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
        return response;
      });
    }),
  );
});
