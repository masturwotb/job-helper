/* ============================================================
   Service Worker — офлайн-кэш и обновления по сети (OTA).
   Как обновлять приложение без пересборки:
     1) меняешь файлы (js/css/html) и поднимаешь CACHE_VERSION ниже
        (и версию в js/version.js);
     2) выкладываешь на хостинг;
     3) у пользователей появляется новый SW -> приложение
        предлагает «Обновить» и подтягивает свежие файлы.
   ============================================================ */
const CACHE_VERSION = "1.0.0-beta";
const CACHE_NAME = "jobhelper-" + CACHE_VERSION;

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./css/styles.css",
  "./js/version.js",
  "./js/background.js",
  "./js/config.js",
  "./js/utils.js",
  "./js/db.js",
  "./js/salary.js",
  "./js/calendar.js",
  "./js/salaryview.js",
  "./js/charts.js",
  "./js/statsview.js",
  "./js/settings.js",
  "./js/sync.js",
  "./js/pwa.js",
  "./js/app.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)).catch(() => {})
  );
  // не активируем автоматически — ждём команды от страницы (чтобы не прервать работу)
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
  if (e.data && e.data.type === "GET_VERSION") {
    e.source && e.source.postMessage({ type: "VERSION", version: CACHE_VERSION });
  }
});

// Стратегия: cache-first для своих ассетов (быстро и офлайн),
// сеть для остального. Навигация -> отдаём index.html из кэша офлайн.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // сторонние (шрифты, sync API) — как есть

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // подкэшируем успешные ответы своего origin
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
