const CACHE_PREFIX = "zgr-cv-shell-";
const CACHE_NAME = `${CACHE_PREFIX}__BUILD_ID__`;
const PRECACHE_URLS = __PRECACHE_URLS__;
const scopeUrl = new URL(self.registration.scope);
const indexUrl = new URL("./index.html", scopeUrl).href;

function isPrivateOrDynamic(url) {
  return (
    url.pathname.includes("/api/") ||
    url.pathname.endsWith("/health") ||
    url.pathname.endsWith("/version.json")
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_URLS.map((entry) => new URL(entry, scopeUrl).href)),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== scopeUrl.origin || isPrivateOrDynamic(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(indexUrl, copy)));
          }
          return response;
        })
        .catch(async () => (await caches.match(indexUrl)) || Response.error()),
    );
    return;
  }

  const isAppAsset =
    url.pathname.includes("/assets/") ||
    url.pathname.includes("/icons/") ||
    url.pathname.endsWith("/manifest.webmanifest");
  if (!isAppAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
        }
        return response;
      });
    }),
  );
});
