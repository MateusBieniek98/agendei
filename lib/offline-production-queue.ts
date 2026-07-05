"use client";

const DB_NAME = "gn-offline";
const DB_VERSION = 1;
const STORE_NAME = "productionQueue";
const LEGACY_QUEUE_KEY = "gn:pendentes";
const LAST_SYNC_KEY = "gn:last-manual-sync";
const QUEUE_CHANGED_EVENT = "gn:offline-production-queue-changed";
const QUEUE_PULSE_KEY = "gn:offline-production-queue-updated-at";

export type OfflineProductionPayload = {
  client_id?: string;
  data?: string;
  equipe_id?: string;
  atividade_id?: string;
  projeto_id?: string | null;
  talhao?: string | null;
  quantidade?: number;
  descarte?: number | null;
  insumos?: { insumo_id?: string; id?: string; nome?: string; quantidade: number }[];
  observacoes?: string | null;
  valor_unitario_snapshot?: number | string;
  [key: string]: unknown;
};

export type OfflineQueueStatus = "pending" | "syncing" | "failed";

export type OfflineProductionQueueItem = {
  clientId: string;
  payload: OfflineProductionPayload;
  status: OfflineQueueStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  lastAttemptAt: string | null;
};

export type OfflineProductionQueueSnapshot = {
  items: OfflineProductionQueueItem[];
  total: number;
  pending: number;
  syncing: number;
  failed: number;
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
        }
      };

      request.onsuccess = () => resolve(request.result);
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
  const items = await requestToPromise<OfflineProductionQueueItem[]>(request);
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

function normalizeQueueItem(item: OfflineProductionQueueItem): OfflineProductionQueueItem {
  const status: OfflineQueueStatus =
    item.status === "syncing" || item.status === "failed" || item.status === "pending"
      ? item.status
      : "pending";

  return {
    clientId: item.clientId,
    payload: { ...item.payload, client_id: item.clientId },
    status,
    attempts: Number.isFinite(item.attempts) ? Math.max(0, item.attempts) : 0,
    lastError: item.lastError ?? null,
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

function readLastSync() {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

function writeLastSync(value: string) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(LAST_SYNC_KEY, value);
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
    payload: { ...payload, client_id: rawClientId },
    status: "pending",
    attempts: 0,
    lastError: null,
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
  const clientId = normalizeClientId(payload.client_id) ?? createOfflineProductionClientId();
  const createdAt = nowISO();
  const item: OfflineProductionQueueItem = {
    clientId,
    payload: { ...payload, client_id: clientId },
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
  const items = await getAllItemsRaw();
  return items
    .map(normalizeQueueItem)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getOfflineProductionSnapshot(): Promise<OfflineProductionQueueSnapshot> {
  const items = await listOfflineProductions();
  return {
    items,
    total: items.length,
    pending: items.filter((item) => item.status === "pending").length,
    syncing: items.filter((item) => item.status === "syncing").length,
    failed: items.filter((item) => item.status === "failed").length,
    lastSync: readLastSync(),
  };
}

async function responseErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { error?: string; message?: string };
    return body.error ?? body.message ?? `Falha ao sincronizar (${response.status}).`;
  } catch {
    return `Falha ao sincronizar (${response.status}).`;
  }
}

async function flushQueueNow(): Promise<OfflineProductionFlushResult> {
  if (!isBrowser()) {
    return { attempted: 0, sent: 0, failed: 0, remaining: 0, lastError: null };
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
    attempted += 1;
    const attemptAt = nowISO();
    const syncingItem: OfflineProductionQueueItem = {
      ...item,
      payload: { ...item.payload, client_id: item.clientId },
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

  const remaining = (await getAllItemsRaw()).length;
  if (remaining === 0) {
    writeLastSync(nowISO());
    emitQueueChanged();
  }

  return { attempted, sent, failed, remaining, lastError };
}

export function flushOfflineProductions() {
  if (!flushPromise) {
    flushPromise = flushQueueNow().finally(() => {
      flushPromise = null;
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
      event.key === LAST_SYNC_KEY
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
