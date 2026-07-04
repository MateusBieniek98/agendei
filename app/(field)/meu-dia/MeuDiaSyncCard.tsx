"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  flushOfflineProductions,
  getOfflineProductionSnapshot,
  subscribeOfflineProductions,
  type OfflineProductionQueueSnapshot,
} from "@/lib/offline-production-queue";

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
  const [snapshot, setSnapshot] = useState<OfflineProductionQueueSnapshot | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await getOfflineProductionSnapshot();
    setOnline(navigator.onLine);
    setSnapshot(next);
    setLastSync(next.lastSync);
  }, []);

  const flushOfflineQueue = useCallback(async (silent = false) => {
    const current = await getOfflineProductionSnapshot();
    if (current.total === 0) {
      if (!silent) setMessage("Sem lançamentos offline pendentes.");
      return;
    }

    setBusy(true);
    if (!silent) setMessage(null);

    try {
      const result = await flushOfflineProductions();
      const next = await getOfflineProductionSnapshot();
      setSnapshot(next);
      setLastSync(next.lastSync);

      if (result.remaining > 0) {
        setMessage(`${result.remaining} pendente(s) continuam na fila.`);
      } else if (!silent) {
        setMessage("Sincronizacao concluida.");
      }
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 10_000);
    const handleOnline = () => {
      setOnline(true);
      void refresh();
      window.setTimeout(() => void flushOfflineQueue(true), 1200);
    };
    const handleOffline = () => {
      setOnline(false);
      void refresh();
    };
    const unsubscribe = subscribeOfflineProductions(() => void refresh());

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsubscribe();
    };
  }, [flushOfflineQueue, refresh]);

  const pending = snapshot?.total ?? 0;
  const failed = snapshot?.failed ?? 0;

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
          {failed > 0 && (
            <p className="text-xs font-semibold" style={{ color: "var(--danger)" }}>
              {failed} lançamento(s) com erro
            </p>
          )}
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
          onClick={() => flushOfflineQueue()}
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
