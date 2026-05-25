"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const QUEUE_KEY = "gn:pendentes";
const LAST_SYNC_KEY = "gn:last-manual-sync";

type PendingItem = Record<string, unknown>;

function readQueue(): PendingItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items: PendingItem[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

function formatDateTime(value: string | null) {
  if (!value) return "Sem registro";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function MeuDiaSyncCard() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function refresh() {
    setOnline(navigator.onLine);
    setPending(readQueue().length);
    setLastSync(localStorage.getItem(LAST_SYNC_KEY));
  }

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 10_000);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  async function flushOfflineQueue() {
    const queue = readQueue();
    if (queue.length === 0) {
      setMessage("Sem lançamentos offline pendentes.");
      return;
    }

    setBusy(true);
    setMessage(null);

    const failed: PendingItem[] = [];
    for (const item of queue) {
      try {
        const response = await fetch("/api/producao", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(item),
        });
        if (!response.ok) failed.push(item);
      } catch {
        failed.push(item);
      }
    }

    writeQueue(failed);
    setPending(failed.length);

    if (failed.length > 0) {
      setMessage(`${failed.length} pendente(s) continuam na fila.`);
    } else {
      const now = new Date().toISOString();
      localStorage.setItem(LAST_SYNC_KEY, now);
      setLastSync(now);
      setMessage("Sincronizacao concluida.");
    }

    setBusy(false);
  }

  return (
    <section
      className="rounded-lg border p-3"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
            Sync do celular
          </p>
          <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            {online ? "Online" : "Offline"} · ultima: {formatDateTime(lastSync)}
          </p>
        </div>
        <span
          className="rounded-full px-2 py-1 text-xs font-black tabular"
          style={{
            background: pending > 0 ? "var(--warn-bg)" : "var(--success-bg)",
            color: pending > 0 ? "var(--warn)" : "var(--success)",
          }}
        >
          {pending}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <button
          type="button"
          disabled={busy || !online}
          onClick={flushOfflineQueue}
          className="h-11 rounded-lg px-3 text-sm font-black transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          {busy ? "Enviando..." : "Enviar pendentes"}
        </button>
        <Link
          href="/sincronizar"
          className="grid h-11 place-items-center rounded-lg border px-3 text-xs font-black"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          Abrir
        </Link>
      </div>

      {message && (
        <p className="mt-2 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
          {message}
        </p>
      )}
    </section>
  );
}
