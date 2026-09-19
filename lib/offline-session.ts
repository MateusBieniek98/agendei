"use client";

const ACTIVE_USER_KEY = "forestry-ops:active-user-id";

function normalizedId(value: unknown) {
  if (typeof value !== "string") return null;
  return value.trim() || null;
}

export function setActiveOfflineUserId(userId: string) {
  if (typeof window === "undefined") return;
  const normalized = normalizedId(userId);
  if (!normalized) throw new Error("Usuário ativo inválido.");
  window.localStorage.setItem(ACTIVE_USER_KEY, normalized);
}

export function getActiveOfflineUserId() {
  if (typeof window === "undefined") return null;
  return normalizedId(window.localStorage.getItem(ACTIVE_USER_KEY));
}

export function clearActiveOfflineUserId() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACTIVE_USER_KEY);
}

export function offlineUserStorageKey(key: string, userId = getActiveOfflineUserId()) {
  return userId
    ? `forestry-ops:${userId}:${key}`
    : `forestry-ops:unscoped:${key}`;
}

export const OFFLINE_ACTIVE_USER_STORAGE_KEY = ACTIVE_USER_KEY;
