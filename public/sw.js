/**
 * GN — Service Worker v3
 * Estratégia: navegação network-first com fallback cacheado, assets cache-first.
 * POSTs continuam sob controle do app para que a fila IndexedDB decida o sync.
 */

const CACHE_NAME = "gn-cache-v3";

// Páginas essenciais para pré-cache
const PRE_CACHE = ["/", "/sincronizar", "/meu-dia", "/lancamento", "/resumo", "/maquinas"];

function offlineHtml() {
  return new Response(
    "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>GN Offline</title></head><body style=\"font-family:system-ui,sans-serif;margin:0;padding:24px;background:#061020;color:#fff\"><h1>GN — Offline</h1><p>Sem conexão. Lançamentos feitos pelo app ficam na fila do celular e serão enviados quando a internet voltar.</p></body></html>",
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

/* ── Install ────────────────────────────────────────────── */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRE_CACHE).catch(() => {
        // Silently fail — app may not be built yet
      });
    })
  );
  self.skipWaiting();
});

/* ── Activate ───────────────────────────────────────────── */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ── Fetch ──────────────────────────────────────────────── */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Non-GET requests must reach the app unchanged. Offline queue is handled in IndexedDB.
  if (url.pathname.startsWith("/api/") && request.method !== "GET") {
    return;
  }

  // API GET: network-first, no cache
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(JSON.stringify({ error: "offline", items: [] }), {
            status: 503,
            headers: { "content-type": "application/json" },
          })
      )
    );
    return;
  }

  // Navigation requests: network-first, fallback to cached page shell
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          for (const path of PRE_CACHE) {
            const fallback = await caches.match(path);
            if (fallback) return fallback;
          }
          const root = await caches.match("/");
          return root || offlineHtml();
        })
    );
    return;
  }

  // Static assets (_next/static, images, etc.): cache-first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|ico|webp|woff2?)$/)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok) {
              caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()));
            }
            return res;
          })
      )
    );
    return;
  }
});
