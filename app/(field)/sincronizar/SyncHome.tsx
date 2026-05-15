"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const QUEUE_KEY = "gn:pendentes";
const LAST_SYNC_KEY = "gn:last-manual-sync";

type PendingItem = Record<string, unknown>;

function readQueue(): PendingItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function writeQueue(items: PendingItem[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

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
  const [pending, setPending] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const saudacao = useMemo(() => {
    const first = nome.split(" ")[0] || "equipe";
    return `Olá, ${first}`;
  }, [nome]);

  function refreshLocalState() {
    setOnline(navigator.onLine);
    setPending(readQueue().length);
    setLastSync(localStorage.getItem(LAST_SYNC_KEY));
  }

  useEffect(() => {
    refreshLocalState();

    const handleOnline = () => {
      setOnline(true);
      refreshLocalState();
    };
    const handleOffline = () => setOnline(false);
    const handleStorage = () => refreshLocalState();
    const interval = window.setInterval(refreshLocalState, 10000);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("storage", handleStorage);
      window.clearInterval(interval);
    };
  }, []);

  async function flushOfflineQueue() {
    const queue = readQueue();
    if (queue.length === 0) {
      setMessage({ type: "ok", text: "Nenhum lançamento offline pendente." });
      return;
    }

    setBusy("pendentes");
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
      setMessage({
        type: "error",
        text: `${failed.length} lançamento(s) ainda não foram enviados. Verifique a conexão e tente novamente.`,
      });
    } else {
      const now = new Date().toISOString();
      localStorage.setItem(LAST_SYNC_KEY, now);
      setLastSync(now);
      setMessage({ type: "ok", text: "Lançamentos offline enviados com sucesso." });
    }

    setBusy(null);
  }

  const loading = busy !== null;

  return (
    <div className="-mx-4 -my-4 min-h-[calc(100dvh-156px)] bg-[#061020] px-4 py-5 text-white sm:-mx-0 sm:rounded-3xl sm:p-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_20%_10%,rgba(47,128,237,0.35),transparent_32%),linear-gradient(145deg,#0b1f4a,#061020_60%)] p-5 shadow-2xl shadow-black/30">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-200/80">
                GN Silvicultura
              </p>
              <h1 className="mt-4 text-3xl font-black leading-tight">
                {saudacao}
              </h1>
              <p className="mt-2 max-w-sm text-sm font-semibold text-slate-300">
                Envie lançamentos pendentes do celular e confira se o app está pronto para uso em campo.
              </p>
            </div>
            <div
              className={`rounded-full px-3 py-1 text-xs font-black ${
                online ? "bg-emerald-400/15 text-emerald-300" : "bg-red-400/15 text-red-300"
              }`}
            >
              {online ? "Online" : "Offline"}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-bold text-slate-400">Pendentes no celular</p>
              <p className="mt-2 text-3xl font-black tabular-nums">{pending}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-bold text-slate-400">Última sincronização</p>
              <p className="mt-2 text-base font-black">{formatDateTime(lastSync)}</p>
            </div>
          </div>
        </section>

        {message && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
              message.type === "ok"
                ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                : "border-red-400/25 bg-red-400/10 text-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        <section className="grid gap-3">
          <button
            type="button"
            disabled={loading || !online}
            onClick={flushOfflineQueue}
            className="min-h-[64px] rounded-2xl bg-blue-500 px-5 text-left text-base font-black text-white shadow-lg shadow-blue-950/40 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === "pendentes" ? "Enviando pendentes..." : "Enviar lançamentos offline pendentes"}
            <span className="block text-xs font-bold text-blue-100">
              Usa a fila local salva quando o sinal cai.
            </span>
          </button>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <Link
            href="/lancamento"
            className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 text-sm font-black text-white"
          >
            + Novo lançamento
            <span className="block pt-1 text-xs font-bold text-slate-400">
              Apontar produção
            </span>
          </Link>
          <Link
            href="/resumo"
            className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 text-sm font-black text-white"
          >
            Ver resultados
            <span className="block pt-1 text-xs font-bold text-slate-400">
              Faturamento e produção
            </span>
          </Link>
        </section>
      </div>
    </div>
  );
}
