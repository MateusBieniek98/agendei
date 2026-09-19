"use client";

import { clearActiveOfflineUserId } from "@/lib/offline-session";

export async function clearAuthenticatedClientState() {
  clearActiveOfflineUserId();

  if (typeof window !== "undefined" && "caches" in window) {
    const cacheNames = await window.caches.keys();
    await Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName)));
  }

  if (typeof navigator !== "undefined" && navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "CLEAR_USER_DATA" });
  }
}
