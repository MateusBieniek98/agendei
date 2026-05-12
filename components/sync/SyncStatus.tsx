"use client";

/**
 * SyncStatus — ícone de status de conexão e fila offline.
 *
 * Estados:
 *  - Sincronizando → spinner azul
 *  - Offline + pendentes → ícone wifi-off âmbar + badge com contagem
 *  - Offline + sem pendentes → ícone wifi-off cinza
 *  - Online + pendentes → botão nuvem para forçar sync + contagem
 *  - Online + limpo → check verde
 */

import { useEffect, useState, useCallback } from "react";

const QUEUE_KEY = "gn:pendentes";

type PendingItem = Record<string, unknown>;

function readQueue(): PendingItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeQueue(items: PendingItem[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

/* ── Icons ──────────────────────────────────────────────── */
function SpinIcon() {
  return (
    <svg
      className="animate-spin"
      width="18" height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--accent)"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function WifiOffIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <circle cx="12" cy="20" r="1" fill={color} stroke="none" />
    </svg>
  );
}

function CloudUpIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}

function CheckIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/* ── Main component ─────────────────────────────────────── */
export default function SyncStatus({ className = "" }: { className?: string }) {
  const [online,  setOnline]  = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [error,   setError]   = useState(false);

  const refresh = useCallback(() => {
    setPending(readQueue().length);
  }, []);

  const flush = useCallback(async () => {
    const queue = readQueue();
    if (queue.length === 0) return;
    setSyncing(true);
    setError(false);
    const failed: PendingItem[] = [];
    for (const item of queue) {
      try {
        const r = await fetch("/api/producao", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(item),
        });
        if (!r.ok) failed.push(item);
      } catch {
        failed.push(item);
      }
    }
    writeQueue(failed);
    setPending(failed.length);
    setSyncing(false);
    if (failed.length > 0) setError(true);
    // Notify other tabs
    window.dispatchEvent(new StorageEvent("storage", { key: QUEUE_KEY }));
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    refresh();

    const handleOnline = () => {
      setOnline(true);
      // Small delay to ensure network is stable
      setTimeout(() => flush(), 1500);
    };
    const handleOffline = () => setOnline(false);
    const handleStorage = (e: StorageEvent) => {
      if (!e.key || e.key === QUEUE_KEY) refresh();
    };

    window.addEventListener("online",  handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("storage", handleStorage);

    const interval = setInterval(refresh, 15_000);

    return () => {
      window.removeEventListener("online",  handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("storage", handleStorage);
      clearInterval(interval);
    };
  }, [refresh, flush]);

  /* ── Render ─────────────────────────────────────────────── */
  const base = `relative flex items-center justify-center w-8 h-8 rounded-xl transition-all ${className}`;

  if (syncing) {
    return (
      <div className={base} title="Sincronizando lançamentos offline...">
        <SpinIcon />
      </div>
    );
  }

  if (!online) {
    return (
      <div
        className={base}
        title={pending > 0
          ? `Offline — ${pending} lançamento(s) serão enviados ao reconectar`
          : "Sem conexão com a internet"}
        style={{ color: pending > 0 ? "var(--warn)" : "var(--text-muted)" }}
      >
        <WifiOffIcon color={pending > 0 ? "var(--warn)" : "var(--text-muted)"} />
        {pending > 0 && (
          <span
            className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-[9px] font-bold"
            style={{
              width: 16, height: 16,
              background: "var(--warn)",
              color: "#fff",
            }}
          >
            {pending > 9 ? "9+" : pending}
          </span>
        )}
      </div>
    );
  }

  if (pending > 0) {
    return (
      <button
        className={base}
        onClick={flush}
        title={`${pending} lançamento(s) pendentes — clique para sincronizar`}
        style={{ color: error ? "var(--danger)" : "var(--accent)" }}
      >
        <CloudUpIcon color={error ? "var(--danger)" : "var(--accent)"} />
        <span
          className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-[9px] font-bold"
          style={{
            width: 16, height: 16,
            background: error ? "var(--danger)" : "var(--accent)",
            color: "#fff",
          }}
        >
          {pending > 9 ? "9+" : pending}
        </span>
      </button>
    );
  }

  return (
    <div
      className={base}
      title="Online — todos os lançamentos sincronizados"
      style={{ color: "var(--success)" }}
    >
      <CheckIcon color="var(--success)" />
    </div>
  );
}
