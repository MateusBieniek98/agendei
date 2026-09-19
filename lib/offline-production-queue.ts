"use client";

import { normalizeOfflineOwnerId, offlineOwnerMatchesSession } from "@/lib/offline-owner";
import {
  getActiveOfflineUserId,
  offlineUserStorageKey,
  OFFLINE_ACTIVE_USER_STORAGE_KEY,
} from "@/lib/offline-session";

const DB_NAME = "gn-offline";
const DB_VERSION = 2;
const STORE_NAME = "productionQueue";
const LEGACY_QUEUE_KEY = "gn:pendentes";
const QUEUE_CHANGED_EVENT = "gn:offline-production-queue-changed";
const QUEUE_PULSE_KEY = "gn:offline-production-queue-updated-at";

export type OfflineProductionPayload = {
  client_id?: string;
  client_user_id?: string;
  data?: string;
  equipe_id?: string;
  atividade_id?: string;
  projeto_id?: string | null;
  talhao_id?: string | null;
  talhao?: string | null;
  quantidade?: number;
  descarte?: number | null;
  insumos?: { insumo_id?: string; id?: string; nome?: string; quantidade: number }[];
  observacoes?: string | null;
  valor_unitario_snapshot?: number | string;
  [key: string]: unknown;
};

export type OfflineQueueStatus = "pending" | "syncing" | "failed" | "blocked";

export type OfflineProductionQueueItem = {
  clientId: string;
  ownerUserId: string | null;
  payload: OfflineProductionPayload;
  status: OfflineQueueStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  lastAttemptAt: string | null;
};

type StoredOfflineProductionQueueItem = Omit<OfflineProductionQueueItem, "ownerUserId"> & {
  ownerUserId?: unknown;
};

export type OfflineProductionQueueSnapshot = {
  items: OfflineProductionQueueItem[];
  total: number;
  pending: number;
  syncing: number;
  failed: number;
  unassigned: number;
  lastSync: string | null;
};

export type OfflineProductionFlushResult = {
  attempted: number;
  sent: number;
  failed: number;
  remaining: number;
  lastError: string | null;
};

let dbPromise: Promise<IDBDatabase> | null = null;
let migrationPromise: Promise<void> | null = null;
let flushPromise: Promise<OfflineProductionFlushResult> | null = null;
let flushOwnerUserId: string | null = null;

function isBrowser() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function nowISO() {
  return new Date().toISOString();
}

function safeDateFromTimestamp(value: unknown) {
  const ts = typeof value === "number" && Number.isFinite(value) ? value : Date.now();
  const date = new Date(ts);
  return Number.isFinite(date.getTime()) ? date.toISOString() : nowISO();
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10);
}

export function createOfflineProductionClientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `offline-${Date.now()}-${randomSuffix()}`;
}

function normalizeClientId(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha no IndexedDB."));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Falha na transação offline."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Transação offline abortada."));
  });
}

function openQueueDb() {
  if (!isBrowser()) {
    return Promise.reject(new Error("IndexedDB indisponível neste ambiente."));
  }

  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "clientId" });
          store.createIndex("status", "status", { unique: false });
          store.createIndex("createdAt", "createdAt", { unique: false });
          store.createIndex("ownerUserId", "ownerUserId", { unique: false });
        } else {
          const store = request.transaction!.objectStore(STORE_NAME);
          if (!store.indexNames.contains("ownerUserId")) {
            store.createIndex("ownerUserId", "ownerUserId", { unique: false });
          }
        }
      };

      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onblocked = () =>
        reject(new Error("Feche outras abas do app para atualizar a fila offline."));
      request.onerror = () => reject(request.error ?? new Error("Falha ao abrir fila offline."));
    });
  }

  return dbPromise;
}

async function getAllItemsRaw() {
  const db = await openQueueDb();
  const transaction = db.transaction(STORE_NAME, "readonly");
  const done = transactionDone(transaction);
  const request = transaction.objectStore(STORE_NAME).getAll();
  const items = await requestToPromise<StoredOfflineProductionQueueItem[]>(request);
  await done;
  return items;
}

async function putItemRaw(item: OfflineProductionQueueItem) {
  const db = await openQueueDb();
  const transaction = db.transaction(STORE_NAME, "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore(STORE_NAME).put(item);
  await done;
}

async function deleteItemRaw(clientId: string) {
  const db = await openQueueDb();
  const transaction = db.transaction(STORE_NAME, "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore(STORE_NAME).delete(clientId);
  await done;
}

function normalizeQueueItem(item: StoredOfflineProductionQueueItem): OfflineProductionQueueItem {
  const ownerUserId = normalizeOfflineOwnerId(
    item.ownerUserId ?? item.payload?.client_user_id,
  );
  const status: OfflineQueueStatus =
    ownerUserId === null
      ? "blocked"
      : item.status === "syncing" ||
          item.status === "failed" ||
          item.status === "pending"
      ? item.status
      : "pending";

  return {
    clientId: item.clientId,
    ownerUserId,
    payload: {
      ...item.payload,
      client_id: item.clientId,
      ...(ownerUserId ? { client_user_id: ownerUserId } : {}),
    },
    status,
    attempts: Number.isFinite(item.attempts) ? Math.max(0, item.attempts) : 0,
    lastError:
      ownerUserId === null
        ? "Autoria não confirmada. Revise este lançamento antes de sincronizar."
        : item.lastError ?? null,
    createdAt: item.createdAt || nowISO(),
    updatedAt: item.updatedAt || item.createdAt || nowISO(),
    lastAttemptAt: item.lastAttemptAt ?? null,
  };
}

function emitQueueChanged() {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(QUEUE_CHANGED_EVENT));
  try {
    window.localStorage.setItem(QUEUE_PULSE_KEY, nowISO());
  } catch {
    // Cross-tab notifications are best effort only.
  }
}

function readLastSync(userId: string) {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(offlineUserStorageKey("last-manual-sync", userId));
  } catch {
    return null;
  }
}

function writeLastSync(userId: string, value: string) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(offlineUserStorageKey("last-manual-sync", userId), value);
  } catch {
    // Last sync is informative; queue integrity does not depend on it.
  }
}

function legacyPayloadToItem(raw: Record<string, unknown>, index: number): OfflineProductionQueueItem {
  const rawClientId =
    normalizeClientId(raw.client_id) ??
    normalizeClientId(raw.clientId) ??
    `legacy-${typeof raw.ts === "number" ? raw.ts : Date.now()}-${index}-${randomSuffix()}`;
  const payload = { ...raw };
  delete payload.ts;
  delete payload.client_id;
  delete payload.clientId;
  const createdAt = safeDateFromTimestamp(raw.ts);

  return {
    clientId: rawClientId,
    ownerUserId: null,
    payload: { ...payload, client_id: rawClientId },
    status: "blocked",
    attempts: 0,
    lastError: "Autoria não confirmada. Revise este lançamento antes de sincronizar.",
    createdAt,
    updatedAt: createdAt,
    lastAttemptAt: null,
  };
}

async function migrateLegacyQueue() {
  if (!isBrowser()) return;
  if (migrationPromise) return migrationPromise;

  migrationPromise = (async () => {
    let parsed: unknown;
    try {
      const raw = window.localStorage.getItem(LEGACY_QUEUE_KEY);
      parsed = raw ? JSON.parse(raw) : [];
    } catch {
      parsed = [];
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      try {
        window.localStorage.removeItem(LEGACY_QUEUE_KEY);
      } catch {
        // Ignore storage cleanup failures.
      }
      return;
    }

    const existing = new Set((await getAllItemsRaw()).map((item) => item.clientId));
    for (const [index, rawItem] of parsed.entries()) {
      if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) continue;
      const item = legacyPayloadToItem(rawItem as Record<string, unknown>, index);
      if (!existing.has(item.clientId)) {
        await putItemRaw(item);
        existing.add(item.clientId);
      }
    }

    try {
      window.localStorage.removeItem(LEGACY_QUEUE_KEY);
    } catch {
      // The IndexedDB copy is already persisted.
    }
    emitQueueChanged();
  })();

  return migrationPromise;
}

export async function enqueueOfflineProduction(payload: OfflineProductionPayload) {
  await migrateLegacyQueue();
  const ownerUserId = getActiveOfflineUserId();
  if (!ownerUserId) throw new Error("Usuário ativo não identificado.");
  const clientId = normalizeClientId(payload.client_id) ?? createOfflineProductionClientId();
  const createdAt = nowISO();
  const item: OfflineProductionQueueItem = {
    clientId,
    ownerUserId,
    payload: { ...payload, client_id: clientId, client_user_id: ownerUserId },
    status: "pending",
    attempts: 0,
    lastError: null,
    createdAt,
    updatedAt: createdAt,
    lastAttemptAt: null,
  };

  await putItemRaw(item);
  emitQueueChanged();
  return item;
}

export async function listOfflineProductions() {
  await migrateLegacyQueue();
  const ownerUserId = getActiveOfflineUserId();
  if (!ownerUserId) return [];
  const items = await getAllItemsRaw();
  return items
    .map(normalizeQueueItem)
    .filter((item) => item.ownerUserId === ownerUserId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getOfflineProductionSnapshot(): Promise<OfflineProductionQueueSnapshot> {
  await migrateLegacyQueue();
  const ownerUserId = getActiveOfflineUserId();
  const items = await listOfflineProductions();
  const unassigned = ownerUserId
    ? (await getAllItemsRaw())
        .map(normalizeQueueItem)
        .filter((item) => item.ownerUserId === null).length
    : 0;
  return {
    items,
    total: items.length,
    pending: items.filter((item) => item.status === "pending").length,
    syncing: items.filter((item) => item.status === "syncing").length,
    failed: items.filter((item) => item.status === "failed").length,
    unassigned,
    lastSync: ownerUserId ? readLastSync(ownerUserId) : null,
  };
}

export async function claimUnassignedOfflineProductions() {
  await migrateLegacyQueue();
  const ownerUserId = getActiveOfflineUserId();
  if (!ownerUserId) throw new Error("Usuário ativo não identificado.");

  const items = (await getAllItemsRaw()).map(normalizeQueueItem);
  let claimed = 0;
  for (const item of items) {
    if (item.ownerUserId !== null) continue;
    const updatedAt = nowISO();
    await putItemRaw({
      ...item,
      ownerUserId,
      payload: {
        ...item.payload,
        client_id: item.clientId,
        client_user_id: ownerUserId,
      },
      status: "pending",
      lastError: null,
      updatedAt,
    });
    claimed += 1;
  }

  if (claimed > 0) emitQueueChanged();
  return claimed;
}

async function responseErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { error?: string; message?: string };
    return body.error ?? body.message ?? `Falha ao sincronizar (${response.status}).`;
  } catch {
    return `Falha ao sincronizar (${response.status}).`;
  }
}

async function flushQueueNow(ownerUserId: string): Promise<OfflineProductionFlushResult> {
  if (!isBrowser()) {
    return { attempted: 0, sent: 0, failed: 0, remaining: 0, lastError: null };
  }

  if (getActiveOfflineUserId() !== ownerUserId) {
    return {
      attempted: 0,
      sent: 0,
      failed: 0,
      remaining: 0,
      lastError: "A sessão mudou antes da sincronização.",
    };
  }

  const items = (await listOfflineProductions()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  if (items.length === 0) {
    return { attempted: 0, sent: 0, failed: 0, remaining: 0, lastError: null };
  }

  if (!navigator.onLine) {
    return {
      attempted: 0,
      sent: 0,
      failed: items.length,
      remaining: items.length,
      lastError: "Sem conexão com a internet.",
    };
  }

  let attempted = 0;
  let sent = 0;
  let failed = 0;
  let lastError: string | null = null;

  for (const item of items) {
    if (
      getActiveOfflineUserId() !== ownerUserId ||
      !offlineOwnerMatchesSession(item.ownerUserId, ownerUserId)
    ) {
      lastError = "A sessão mudou durante a sincronização. Tente novamente com o usuário correto.";
      break;
    }
    attempted += 1;
    const attemptAt = nowISO();
    const syncingItem: OfflineProductionQueueItem = {
      ...item,
      payload: {
        ...item.payload,
        client_id: item.clientId,
        client_user_id: ownerUserId,
      },
      status: "syncing",
      attempts: item.attempts + 1,
      lastError: null,
      lastAttemptAt: attemptAt,
      updatedAt: attemptAt,
    };

    await putItemRaw(syncingItem);
    emitQueueChanged();

    try {
      const response = await fetch("/api/producao", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(syncingItem.payload),
      });

      if (response.ok) {
        await deleteItemRaw(item.clientId);
        sent += 1;
        emitQueueChanged();
        continue;
      }

      const message = await responseErrorMessage(response);
      lastError = message;
      failed += 1;
      await putItemRaw({
        ...syncingItem,
        status: "failed",
        lastError: message,
        updatedAt: nowISO(),
      });
      emitQueueChanged();
    } catch {
      const message = "Sem conexão estável para enviar este lançamento.";
      lastError = message;
      failed += 1;
      await putItemRaw({
        ...syncingItem,
        status: "failed",
        lastError: message,
        updatedAt: nowISO(),
      });
      emitQueueChanged();
    }
  }

  const remaining = (await listOfflineProductions()).length;
  if (remaining === 0) {
    writeLastSync(ownerUserId, nowISO());
    emitQueueChanged();
  }

  return { attempted, sent, failed, remaining, lastError };
}

export function flushOfflineProductions() {
  const ownerUserId = getActiveOfflineUserId();
  if (!ownerUserId) {
    return Promise.resolve({
      attempted: 0,
      sent: 0,
      failed: 0,
      remaining: 0,
      lastError: "Usuário ativo não identificado.",
    });
  }
  if (flushPromise && flushOwnerUserId !== ownerUserId) {
    return Promise.resolve({
      attempted: 0,
      sent: 0,
      failed: 0,
      remaining: 0,
      lastError: "Outro usuário ainda está sincronizando neste dispositivo.",
    });
  }
  if (!flushPromise) {
    flushOwnerUserId = ownerUserId;
    flushPromise = flushQueueNow(ownerUserId).finally(() => {
      flushPromise = null;
      flushOwnerUserId = null;
    });
  }
  return flushPromise;
}

export function subscribeOfflineProductions(listener: () => void) {
  if (!isBrowser()) return () => {};

  const handleChange = () => listener();
  const handleStorage = (event: StorageEvent) => {
    if (
      !event.key ||
      event.key === LEGACY_QUEUE_KEY ||
      event.key === QUEUE_PULSE_KEY ||
      event.key === OFFLINE_ACTIVE_USER_STORAGE_KEY ||
      event.key === offlineUserStorageKey("last-manual-sync")
    ) {
      listener();
    }
  };

  window.addEventListener(QUEUE_CHANGED_EVENT, handleChange);
  window.addEventListener("storage", handleStorage);
  void migrateLegacyQueue().then(listener);

  return () => {
    window.removeEventListener(QUEUE_CHANGED_EVENT, handleChange);
    window.removeEventListener("storage", handleStorage);
  };
}
