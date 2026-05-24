"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { brl, ddmmyyyy, num } from "@/lib/format";

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

type PendingItem = {
  ts?: number;
  data?: string;
  equipe_id?: string;
  atividade_id?: string;
  quantidade?: number;
  valor_unitario_snapshot?: number;
  talhao?: string;
  observacoes?: string | null;
};

const QUEUE_KEY = "gn:pendentes";

function readQueue(): PendingItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function syncBadge(pending: boolean) {
  return pending
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

function GaugeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M12 14l3-3" />
      <path d="M4 14a8 8 0 1 1 16 0" />
      <path d="M5.5 18h13" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function DashboardShortcutCards() {
  return (
    <div className="grid grid-cols-2 gap-2">
      <DashboardShortcutCard
        href="/gestor?tab=indicadores"
        title="Indicadores"
        subtitle="Dashboard Geral"
        icon={<GaugeIcon />}
      />
      <DashboardShortcutCard
        href="/gestor?tab=equipes"
        title="Equipes"
        subtitle="Análise de Desempenho"
        icon={<UsersIcon />}
      />
    </div>
  );
}

function DashboardShortcutCard({
  href,
  title,
  subtitle,
  icon,
}: {
  href: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border p-3 transition hover:-translate-y-0.5 hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
      aria-label={`Abrir ${title}`}
    >
      <div
        className="mb-2 grid h-9 w-9 place-items-center rounded-lg transition group-hover:scale-105"
        style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
      >
        {icon}
      </div>
      <p className="truncate text-sm font-black" style={{ color: "var(--text-primary)" }}>
        {title}
      </p>
      <p className="mt-0.5 truncate text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
        {subtitle}
      </p>
    </Link>
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
  const [pendentes, setPendentes] = useState<PendingItem[]>([]);

  useEffect(() => {
    const refresh = () => setPendentes(readQueue());
    refresh();

    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === QUEUE_KEY) refresh();
    };

    window.addEventListener("storage", onStorage);
    const interval = window.setInterval(refresh, 10_000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearInterval(interval);
    };
  }, []);

  const atividadeMap = useMemo(
    () => new Map(atividades.map((atividade) => [atividade.id, atividade])),
    [atividades]
  );

  const pendentesDaEquipe = pendentes
    .filter((item) => equipeId === null || item.equipe_id === equipeId)
    .sort((a, b) => Number(b.ts ?? 0) - Number(a.ts ?? 0));

  const totalRegistros = linhas.length + pendentesDaEquipe.length;

  return (
    <section className="mx-auto max-w-2xl space-y-3">
      <DashboardShortcutCards />

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
          {pendentesDaEquipe.map((item, index) => {
            const atividade = item.atividade_id ? atividadeMap.get(item.atividade_id) : undefined;
            const quantidade = Number(item.quantidade ?? 0);
            const valorUnitario = Number(item.valor_unitario_snapshot ?? atividade?.valor_unitario ?? 0);
            const total = quantidade * valorUnitario;
            return (
              <ResultadoCard
                key={`${item.ts ?? "pending"}-${index}`}
                title={atividade?.nome ?? "Atividade pendente"}
                unidade={atividade?.unidade ?? "ha"}
                data={item.data ?? ""}
                quantidade={quantidade}
                faturamento={total}
                talhao={item.talhao ?? null}
                observacoes={item.observacoes ?? null}
                pending
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
  pending = false,
  editHref,
}: {
  title: string;
  unidade: string;
  data: string;
  quantidade: number;
  faturamento: number;
  talhao: string | null;
  observacoes: string | null;
  pending?: boolean;
  editHref?: string;
}) {
  const badge = syncBadge(pending);

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
