const CACHE_NAME = "mobank-cache-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/css/style.css",
  "/css/leaderboard.css",
  "/css/privacy.css",
  "/js/main.js",
  "/js/auth.js",
  "/js/dashboard.js",
  "/js/leaderboard.js",
  "/js/toast.js",
  "/js/transfer.js",
  "/images/favicon_512.png",
  "/images/favicon_192.png",
  "/images/default_profile.svg",
  "/images/google-icon.svg",
  "/images/profile.svg",
  "/pages/admin.html",
  "/pages/dashboard.html",
  "/pages/leaderboard.html",
  "/pages/login.html",
  "/pages/privacy.html",
  "/pages/profile.html",
  "/pages/transfer.html"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.url.includes("/api/")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});
