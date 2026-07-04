"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  flushOfflineProductions,
  getOfflineProductionSnapshot,
  subscribeOfflineProductions,
  type OfflineProductionQueueSnapshot,
} from "@/lib/offline-production-queue";

function formatDateTime(value: string | null) {
  if (!value) return "Ainda não sincronizado";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function SyncHome({
  nome,
}: {
  nome: string;
}) {
  const [online, setOnline] = useState(true);
  const [snapshot, setSnapshot] = useState<OfflineProductionQueueSnapshot | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const saudacao = useMemo(() => {
    const first = nome.split(" ")[0] || "equipe";
    return `Olá, ${first}`;
  }, [nome]);

  const refreshLocalState = useCallback(async () => {
    const next = await getOfflineProductionSnapshot();
    setOnline(navigator.onLine);
    setSnapshot(next);
    setLastSync(next.lastSync);
  }, []);

  const flushOfflineQueue = useCallback(async (silent = false) => {
    const current = await getOfflineProductionSnapshot();
    if (current.total === 0) {
      if (!silent) setMessage({ type: "ok", text: "Nenhum lançamento offline pendente." });
      return;
    }

    setBusy("pendentes");
    if (!silent) setMessage(null);

    try {
      const result = await flushOfflineProductions();
      const next = await getOfflineProductionSnapshot();
      setSnapshot(next);
      setLastSync(next.lastSync);

      if (result.remaining > 0) {
        setMessage({
          type: "error",
          text: `${result.remaining} lançamento(s) ainda não foram enviados. ${result.lastError ?? "Verifique a conexão e tente novamente."}`,
        });
      } else if (!silent) {
        setMessage({
          type: "ok",
          text: result.sent > 0 ? "Lançamentos offline enviados com sucesso." : "Nenhum lançamento offline pendente.",
        });
      }
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    void refreshLocalState();

    const handleOnline = () => {
      setOnline(true);
      void refreshLocalState();
      window.setTimeout(() => void flushOfflineQueue(true), 1200);
    };
    const handleOffline = () => setOnline(false);
    const unsubscribe = subscribeOfflineProductions(() => void refreshLocalState());
    const interval = window.setInterval(() => void refreshLocalState(), 10000);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsubscribe();
      window.clearInterval(interval);
    };
  }, [flushOfflineQueue, refreshLocalState]);

  const loading = busy !== null;
  const pending = snapshot?.total ?? 0;
  const failed = snapshot?.failed ?? 0;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <section
        className="rounded-lg border p-4 shadow-sm"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>
              GN Silvicultura
            </p>
            <h1 className="mt-1 text-2xl font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
              {saudacao}
            </h1>
            <p className="mt-1 max-w-sm text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
              Sincronização e fila local da operação.
            </p>
          </div>
          <div
            className="rounded-md px-2.5 py-1 text-xs font-bold"
            style={{
              background: online ? "var(--success-bg)" : "var(--danger-bg)",
              color: online ? "var(--success)" : "var(--danger)",
            }}
          >
            {online ? "Online" : "Offline"}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-lg border p-3" style={{ background: "var(--bg-card-alt)", borderColor: "var(--border)" }}>
            <p className="text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>Pendentes</p>
            <p className="mt-1 text-3xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{pending}</p>
            {failed > 0 && (
              <p className="mt-1 text-xs font-bold" style={{ color: "var(--danger)" }}>
                {failed} com erro
              </p>
            )}
          </div>
          <div className="rounded-lg border p-3" style={{ background: "var(--bg-card-alt)", borderColor: "var(--border)" }}>
            <p className="text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>Última sync</p>
            <p className="mt-1 text-base font-bold" style={{ color: "var(--text-primary)" }}>{formatDateTime(lastSync)}</p>
          </div>
        </div>
      </section>

      {message && (
        <div
          className="rounded-lg border px-4 py-3 text-sm font-bold"
          style={{
            background: message.type === "ok" ? "var(--success-bg)" : "var(--danger-bg)",
            borderColor: message.type === "ok" ? "var(--success)" : "var(--danger)",
            color: message.type === "ok" ? "var(--success)" : "var(--danger)",
          }}
        >
          {message.text}
        </div>
      )}

      <section className="grid gap-3">
        <button
          type="button"
          disabled={loading || !online}
          onClick={() => flushOfflineQueue()}
          className="min-h-[56px] rounded-lg border px-4 text-left text-sm font-bold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: "var(--accent)", borderColor: "var(--accent)" }}
        >
          {busy === "pendentes" ? "Enviando pendentes..." : "Enviar pendentes"}
          <span className="block text-xs font-semibold opacity-80">
            {pending} lançamento(s) na fila local.
          </span>
        </button>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <Link
          href="/lancamento"
          className="rounded-lg border p-3 text-sm font-bold"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text-primary)" }}
        >
          + Novo lançamento
          <span className="block pt-1 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            Apontar produção
          </span>
        </Link>
        <Link
          href="/resumo"
          className="rounded-lg border p-3 text-sm font-bold"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text-primary)" }}
        >
          Ver resultados
          <span className="block pt-1 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            Faturamento e produção
          </span>
        </Link>
      </section>
    </div>
  );
}
