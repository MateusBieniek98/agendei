"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { brl, ddmmyyyy, num } from "@/lib/format";
import {
  listOfflineProductions,
  subscribeOfflineProductions,
  type OfflineProductionQueueItem,
} from "@/lib/offline-production-queue";

type AtividadeRef = {
  id: string;
  nome: string;
  unidade: string;
  valor_unitario: number | string;
};

export type ResultadoLinha = {
  id: string;
  data: string;
  equipe_id: string;
  atividade_id: string;
  projeto_id: string | null;
  talhao: string | null;
  quantidade: number | string;
  observacoes: string | null;
  valor_unitario_snapshot: number | string;
  created_at: string;
  equipes: { nome: string } | null;
  atividades: { nome: string; unidade: string } | null;
  projetos: { nome: string } | null;
};

function syncBadge(status: OfflineProductionQueueItem["status"] | "synced") {
  if (status === "failed") {
    return { label: "Erro no Sync", bg: "var(--danger-bg)", color: "var(--danger)" };
  }
  if (status === "syncing") {
    return { label: "Sincronizando", bg: "var(--accent-subtle)", color: "var(--accent)" };
  }
  return status === "pending"
    ? { label: "Pendente de Sync", bg: "var(--warn-bg)", color: "var(--warn)" }
    : { label: "Sincronizado", bg: "var(--success-bg)", color: "var(--success)" };
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export default function ResultadosFeed({
  linhas,
  atividades,
  equipeId,
  ciclo,
}: {
  linhas: ResultadoLinha[];
  atividades: AtividadeRef[];
  equipeId: string | null;
  ciclo: { de: string; ate: string; label: string };
}) {
  const [pendentes, setPendentes] = useState<OfflineProductionQueueItem[]>([]);

  useEffect(() => {
    const refresh = async () => setPendentes(await listOfflineProductions());
    void refresh();

    const unsubscribe = subscribeOfflineProductions(() => void refresh());
    const interval = window.setInterval(() => void refresh(), 10_000);
    return () => {
      unsubscribe();
      window.clearInterval(interval);
    };
  }, []);

  const atividadeMap = useMemo(
    () => new Map(atividades.map((atividade) => [atividade.id, atividade])),
    [atividades]
  );

  const pendentesDaEquipe = pendentes
    .filter((item) => equipeId === null || item.payload.equipe_id === equipeId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalRegistros = linhas.length + pendentesDaEquipe.length;

  return (
    <section className="mx-auto max-w-2xl space-y-3">
      <div
        className="rounded-lg border p-3"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
      >
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-base font-black" style={{ color: "var(--text-primary)" }}>
              Resultados
            </h1>
            <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              Feed da equipe · {ciclo.label}
            </p>
          </div>
          <p className="text-sm font-black tabular" style={{ color: "var(--accent)" }}>
            {totalRegistros}
          </p>
        </div>
      </div>

      {totalRegistros === 0 ? (
        <div
          className="rounded-lg border p-5 text-center text-sm font-semibold"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          Nenhum apontamento encontrado para a equipe neste ciclo.
        </div>
      ) : (
        <ul className="space-y-2">
          {pendentesDaEquipe.map((item) => {
            const atividadeId = typeof item.payload.atividade_id === "string" ? item.payload.atividade_id : "";
            const atividade = atividadeId ? atividadeMap.get(atividadeId) : undefined;
            const quantidade = Number(item.payload.quantidade ?? 0);
            const valorUnitario = Number(item.payload.valor_unitario_snapshot ?? atividade?.valor_unitario ?? 0);
            const total = quantidade * valorUnitario;
            return (
              <ResultadoCard
                key={item.clientId}
                title={atividade?.nome ?? "Atividade pendente"}
                unidade={atividade?.unidade ?? "ha"}
                data={typeof item.payload.data === "string" ? item.payload.data : ""}
                quantidade={quantidade}
                faturamento={total}
                talhao={typeof item.payload.talhao === "string" ? item.payload.talhao : null}
                observacoes={
                  item.lastError ??
                  (typeof item.payload.observacoes === "string" ? item.payload.observacoes : null)
                }
                status={item.status}
              />
            );
          })}

          {linhas.map((linha) => (
            <ResultadoCard
              key={linha.id}
              title={linha.atividades?.nome ?? "Atividade sem nome"}
              unidade={linha.atividades?.unidade ?? "ha"}
              data={linha.data}
              quantidade={Number(linha.quantidade ?? 0)}
              faturamento={Number(linha.quantidade ?? 0) * Number(linha.valor_unitario_snapshot ?? 0)}
              talhao={linha.talhao}
              observacoes={linha.observacoes}
              status="synced"
              editHref={`/lancamento?edit_id=${linha.id}`}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ResultadoCard({
  title,
  unidade,
  data,
  quantidade,
  faturamento,
  talhao,
  observacoes,
  status,
  editHref,
}: {
  title: string;
  unidade: string;
  data: string;
  quantidade: number;
  faturamento: number;
  talhao: string | null;
  observacoes: string | null;
  status: OfflineProductionQueueItem["status"] | "synced";
  editHref?: string;
}) {
  const badge = syncBadge(status);

  return (
    <li
      className="rounded-lg border p-3"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black uppercase" style={{ color: "var(--text-primary)" }}>
            {title}
          </p>
          <p className="mt-0.5 text-base font-black tabular" style={{ color: "var(--text-secondary)" }}>
            {num(quantidade)} {unidade}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
            {data && <span>{ddmmyyyy(data)}</span>}
            {talhao && <span>Talhão {talhao}</span>}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-base font-black tabular" style={{ color: "var(--accent)" }}>
            {brl(faturamento)}
          </p>
          <span
            className="mt-1 inline-flex rounded-full px-2 py-1 text-[10px] font-black"
            style={{ background: badge.bg, color: badge.color }}
          >
            {badge.label}
          </span>
        </div>
      </div>

      {(observacoes || editHref) && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            {observacoes ?? ""}
          </p>
          {editHref && (
            <Link
              href={editHref}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-black transition hover:opacity-80"
              style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
            >
              <PencilIcon />
              Editar
            </Link>
          )}
        </div>
      )}
    </li>
  );
}
