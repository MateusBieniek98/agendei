/**
 * GN — Service Worker v2
 * Estratégia: Network-first para API, Cache-first para páginas estáticas.
 * Permite navegação básica quando offline.
 */

const CACHE_NAME = "gn-cache-v2";

// Páginas essenciais para pré-cache
const PRE_CACHE = ["/lancamento", "/resumo", "/"];

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

  // Skip non-GET API requests — let them fail naturally (offline queue handled in app)
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

  // Navigation requests: network-first, fallback to cache
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // Cache a fresh copy
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          // Last resort: return the root page shell
          const root = await caches.match("/");
          return (
            root ||
            new Response("<h1>GN — Offline</h1><p>Sem conexão. Recarregue quando voltar.</p>", {
              headers: { "content-type": "text/html" },
            })
          );
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
