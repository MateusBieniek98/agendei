/**
 * GN Service Worker v5
 *
 * Conteúdo autenticado nunca é persistido. O app controla a fila IndexedDB;
 * este worker mantém apenas assets públicos e fornece uma resposta offline neutra.
 */

const CACHE_NAME = "gn-public-static-v5";
const PUBLIC_ASSETS = new Set([
  "/gn-login-bg.jpg",
  "/gn-login-logo.jpeg",
  "/gn-logo-card.jpeg",
  "/manifest.webmanifest",
]);

function offlineHtml() {
  return new Response(
    "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>GN offline</title></head><body style=\"font-family:system-ui,sans-serif;margin:0;padding:24px;background:#061020;color:#fff\"><h1>Sem conexão</h1><p>Reconecte-se para abrir o sistema. Lançamentos já salvos na fila continuam preservados neste dispositivo.</p></body></html>",
    {
      status: 503,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CLEAR_USER_DATA") return;
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(() => offlineHtml()),
    );
    return;
  }

  if (url.pathname.startsWith("/api/")) return;

  const cacheable =
    url.pathname.startsWith("/_next/static/") ||
    PUBLIC_ASSETS.has(url.pathname);
  if (!cacheable) return;

  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && response.type === "basic") {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    }),
  );
});
