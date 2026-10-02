const CACHE_VERSION = "trickcal-blueprint-build";
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
  "./src/core/templates.js",
  "./src/core/validator.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  ...BLUEPRINT_ICON_CODES.map((code) => `./blueprint-icons/${code}.webp`),
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) =>
    cache.addAll(APP_FILES.map((path) => new Request(path, { cache: "reload" }))),
  ));
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
  const url = new URL(event.request.url);
  if (!url.href.startsWith(self.registration.scope)) return;
  const networkFirst = event.request.mode === "navigate" || /\.(?:html|css|js)$/.test(url.pathname);
  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(event.request, { ignoreSearch: true });
      if (!networkFirst && cached) return cached;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      try {
        const response = await fetch(event.request, { cache: "reload", signal: controller.signal });
        if (!response.ok && cached) return cached;
        if (!response || response.status !== 200 || response.type === "opaque") return response;
        // Service Workerの保存先を使い、ブラウザーのメモリーキャッシュとの二重管理を防ぐ。
        const headers = new Headers(response.headers);
        if (networkFirst) headers.set("Cache-Control", "no-store");
        const fresh = new Response(response.body, { status: response.status, statusText: response.statusText, headers });
        // バージョン付きCSSも同じURLへ保存し、オフライン時は最新版を返す。
        const cacheUrl = new URL(event.request.url);
        cacheUrl.search = "";
        await cache.put(cacheUrl.href, fresh.clone());
        return fresh;
      } catch (error) {
        if (cached) return cached;
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }),
  );
});
