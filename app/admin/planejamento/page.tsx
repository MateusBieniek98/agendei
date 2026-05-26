"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { brl, ddmmyyyy, num, todayISO } from "@/lib/format";
import type { Atividade, Equipe, Planejamento, PlanningStatus, Projeto } from "@/lib/types";

/* ── Types ─────────────────────────────────────────────── */
type PlanejamentoRow = Planejamento & {
  projetos:   { nome: string } | null;
  atividades: { nome: string; unidade: string; valor_unitario: number } | null;
  equipes:    { nome: string } | null;
  quantidade_realizada:   number;
  pct_realizado:          number;
  faturamento_planejado:  number;
};

type PlanejamentoView = "timeline" | "equipes";
type TimelineGroupBy = "projeto" | "equipe";

const STATUS_OPTS: { value: PlanningStatus; label: string }[] = [
  { value: "planejado",   label: "Planejado"   },
  { value: "em_execucao", label: "Em execução" },
  { value: "concluido",   label: "Concluído"   },
  { value: "cancelado",   label: "Cancelado"   },
];

const STATUS_COLOR: Record<PlanningStatus, string> = {
  planejado:   "var(--accent)",
  em_execucao: "var(--warn)",
  concluido:   "var(--success)",
  cancelado:   "var(--text-muted)",
};

const STATUS_BG: Record<PlanningStatus, string> = {
  planejado:   "var(--accent-subtle)",
  em_execucao: "var(--warn-bg)",
  concluido:   "var(--success-bg)",
  cancelado:   "var(--bg-page)",
};

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const DAY_MS = 24 * 60 * 60 * 1000;

function hoje() { return todayISO(); }

function faturamentoPlanejado(
  qtd: number | null | undefined,
  atividade: { valor_unitario: number } | null | undefined,
) {
  return Number(qtd ?? 0) * Number(atividade?.valor_unitario ?? 0);
}

function utcFromISO(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function diffDays(start: string, end: string) {
  return Math.round((utcFromISO(end) - utcFromISO(start)) / DAY_MS);
}

function addDaysISO(iso: string, days: number) {
  const date = new Date(utcFromISO(iso));
  date.setUTCDate(date.getUTCDate() + days);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shortDate(iso: string) {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

function timelineStart(item: PlanejamentoRow) {
  return item.data_inicio ?? item.data_limite;
}

function timelineRange(item: PlanejamentoRow) {
  const start = timelineStart(item);
  const end = diffDays(start, item.data_limite) >= 0 ? item.data_limite : start;
  return { start, end };
}

function getTimelineBounds(items: PlanejamentoRow[]) {
  if (items.length === 0) return null;
  const starts = items.map((item) => timelineRange(item).start);
  const ends = items.map((item) => timelineRange(item).end);
  const start = starts.reduce((min, date) => (date < min ? date : min), starts[0]);
  const end = ends.reduce((max, date) => (date > max ? date : max), ends[0]);
  return { start, end, totalDays: Math.max(diffDays(start, end) + 1, 1) };
}

function timelineDayWidth(totalDays: number) {
  if (totalDays > 120) return 18;
  if (totalDays > 60) return 24;
  if (totalDays > 32) return 32;
  return 44;
}

function timelineMarkerStep(totalDays: number) {
  if (totalDays > 120) return 30;
  if (totalDays > 60) return 14;
  if (totalDays > 32) return 7;
  if (totalDays > 18) return 3;
  return 1;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function statusLabel(status: PlanningStatus) {
  return STATUS_OPTS.find((item) => item.value === status)?.label ?? status;
}

function timelineGroupLabel(item: PlanejamentoRow, groupBy: TimelineGroupBy) {
  if (groupBy === "equipe") return item.equipes?.nome ?? "Sem equipe";
  return item.projetos?.nome ?? "Sem projeto";
}

function timelineTone(item: PlanejamentoRow) {
  const isLate =
    item.status !== "concluido" &&
    item.status !== "cancelado" &&
    item.data_limite < hoje();

  if (isLate) {
    return { label: "Atrasado", color: "var(--danger)", bg: "var(--danger-bg)" };
  }

  return {
    label: statusLabel(item.status),
    color: STATUS_COLOR[item.status],
    bg: STATUS_BG[item.status],
  };
}

/* ── Progress bar ── */
function ProgressBar({ pct }: { pct: number }) {
  const cor =
    pct >= 100 ? "var(--success)"
    : pct >= 70 ? "var(--accent)"
    : pct >= 40 ? "var(--warn)"
    : "var(--danger)";
  return (
    <div className="rounded-full overflow-hidden" style={{ height: 6, background: "var(--border)" }}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(pct, 100)}%`, background: cor }}
      />
    </div>
  );
}

/* ── Timeline ── */
function PlanejamentoTimeline({
  items,
  groupBy,
  onEditar,
  onConcluir,
}: {
  items: PlanejamentoRow[];
  groupBy: TimelineGroupBy;
  onEditar: (item: PlanejamentoRow) => void;
  onConcluir: (id: string) => void;
}) {
  const bounds = getTimelineBounds(items);
  if (!bounds) return null;

  const dayWidth = timelineDayWidth(bounds.totalDays);
  const timelineWidth = Math.max(bounds.totalDays * dayWidth, 760);
  const markerStep = timelineMarkerStep(bounds.totalDays);
  const markerOffsets = new Set<number>();
  for (let offset = 0; offset < bounds.totalDays; offset += markerStep) {
    markerOffsets.add(offset);
  }
  markerOffsets.add(bounds.totalDays - 1);

  const todayOffset =
    hoje() >= bounds.start && hoje() <= bounds.end
      ? diffDays(bounds.start, hoje()) * dayWidth
      : null;

  const groups = Array.from(
    items.reduce((map, item) => {
      const label = timelineGroupLabel(item, groupBy);
      const current = map.get(label) ?? [];
      current.push(item);
      map.set(label, current);
      return map;
    }, new Map<string, PlanejamentoRow[]>())
  )
    .map(([label, groupItems]) => ({
      label,
      items: groupItems.sort((a, b) => {
        const byStart = timelineStart(a).localeCompare(timelineStart(b));
        return byStart !== 0 ? byStart : a.data_limite.localeCompare(b.data_limite);
      }),
    }))
    .sort((a, b) => timelineStart(a.items[0]).localeCompare(timelineStart(b.items[0])));

  return (
    <div
      className="rounded-2xl p-3 sm:p-4"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <div
        className="flex flex-col gap-2 border-b pb-3 sm:flex-row sm:items-center sm:justify-between"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="min-w-0">
          <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
            Timeline de planejamento
          </p>
          <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            {items.length} {items.length === 1 ? "item" : "itens"} entre {ddmmyyyy(bounds.start)} e {ddmmyyyy(bounds.end)}
          </p>
        </div>
        <span
          className="w-fit rounded-full px-3 py-1 text-xs font-black"
          style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
        >
          {groupBy === "projeto" ? "Por projeto" : "Por equipe"}
        </span>
      </div>

      <div className="mt-3 overflow-x-auto pb-1">
        <div className="space-y-3" style={{ minWidth: timelineWidth, width: timelineWidth }}>
          <div className="relative h-10" style={{ width: timelineWidth }}>
            <div className="absolute bottom-2 left-0 right-0 h-px" style={{ background: "var(--border)" }} />
            {Array.from(markerOffsets)
              .sort((a, b) => a - b)
              .map((offset) => (
                <div
                  key={offset}
                  className="absolute bottom-0 top-2 w-px"
                  style={{ left: offset * dayWidth, background: "var(--border)" }}
                >
                  <span
                    className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] font-bold"
                    style={{ top: -2, color: "var(--text-muted)" }}
                  >
                    {shortDate(addDaysISO(bounds.start, offset))}
                  </span>
                </div>
              ))}
            {todayOffset != null && (
              <div
                className="absolute bottom-0 top-0 w-0.5 rounded-full"
                style={{ left: todayOffset, background: "var(--accent)" }}
              >
                <span
                  className="absolute left-2 top-0 rounded-full px-2 py-0.5 text-[10px] font-black"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  Hoje
                </span>
              </div>
            )}
          </div>

          {groups.map((group) => {
            const faturamento = group.items.reduce(
              (sum, item) => sum + (item.faturamento_planejado ?? faturamentoPlanejado(item.quantidade_prevista, item.atividades)),
              0,
            );
            const mediaRealizada =
              group.items.reduce((sum, item) => sum + (item.pct_realizado ?? 0), 0) / group.items.length;

            return (
              <section
                key={group.label}
                className="rounded-xl p-3"
                style={{ background: "var(--bg-page)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black" style={{ color: "var(--text-primary)" }}>
                      {group.label}
                    </p>
                    <p className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
                      {group.items.length} {group.items.length === 1 ? "atividade" : "atividades"} · {mediaRealizada.toFixed(0)}% realizado
                    </p>
                  </div>
                  <p className="shrink-0 text-xs font-black tabular" style={{ color: "var(--accent)" }}>
                    {brl(faturamento)}
                  </p>
                </div>

                <div className="mt-3 space-y-2">
                  {group.items.map((item) => {
                    const range = timelineRange(item);
                    const startOffset = clamp(diffDays(bounds.start, range.start), 0, bounds.totalDays - 1);
                    const endOffset = clamp(diffDays(bounds.start, range.end), startOffset, bounds.totalDays - 1);
                    const left = startOffset * dayWidth;
                    const width = Math.max((endOffset - startOffset + 1) * dayWidth, 168);
                    const tone = timelineTone(item);
                    const canConcluir = !["concluido", "cancelado"].includes(item.status);
                    const previsto =
                      item.quantidade_prevista != null && item.atividades
                        ? `${num(item.quantidade_prevista, 1)} ${item.atividades.unidade}`
                        : "sem quantidade";

                    return (
                      <div key={item.id} className="relative h-16" style={{ width: timelineWidth }}>
                        <div className="absolute left-0 right-0 top-1/2 h-px" style={{ background: "var(--border)" }} />
                        <div
                          className="absolute top-1 flex h-14 items-center overflow-hidden rounded-lg border px-3"
                          style={{
                            left,
                            width,
                            background: tone.bg,
                            borderColor: tone.color,
                          }}
                        >
                          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-black" style={{ color: "var(--text-primary)" }}>
                                {item.atividades?.nome ?? "Atividade"}
                              </p>
                              <p className="truncate text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                                {item.projetos?.nome ?? "Projeto"} · Talhão {item.talhao} · {previsto}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span
                                className="hidden rounded-full px-2 py-0.5 text-[10px] font-black sm:inline-flex"
                                style={{ color: tone.color, border: `1px solid ${tone.color}` }}
                              >
                                {tone.label}
                              </span>
                              {canConcluir && (
                                <button
                                  type="button"
                                  onClick={() => onConcluir(item.id)}
                                  className="hidden min-h-9 rounded-lg px-3 text-[11px] font-black transition active:opacity-80 sm:inline-flex sm:items-center"
                                  style={{ background: "var(--success-bg)", color: "var(--success)" }}
                                >
                                  Concluir
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onEditar(item)}
                                className="min-h-9 rounded-lg px-3 text-[11px] font-black text-white transition active:opacity-80"
                                style={{ background: "var(--accent)" }}
                              >
                                Editar
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Team Card ── */
function TeamCard({
  nome,
  items,
  onClick,
}: {
  nome: string;
  items: PlanejamentoRow[];
  onClick: () => void;
}) {
  const fat = items.reduce(
    (s, i) => s + (i.faturamento_planejado ?? faturamentoPlanejado(i.quantidade_prevista, i.atividades)),
    0,
  );
  const pctMedio = items.length > 0
    ? items.reduce((s, i) => s + (i.pct_realizado ?? 0), 0) / items.length
    : 0;
  const statusCounts = {
    planejado:   items.filter((i) => i.status === "planejado").length,
    em_execucao: items.filter((i) => i.status === "em_execucao").length,
    concluido:   items.filter((i) => i.status === "concluido").length,
    cancelado:   items.filter((i) => i.status === "cancelado").length,
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-2xl p-5 space-y-3 transition hover:shadow-md active:scale-[0.99]"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      {/* Nome da equipe */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-bold truncate" style={{ color: "var(--text-primary)" }}>
          {nome}
        </h3>
        <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
          {items.length} item{items.length !== 1 ? "s" : ""} →
        </span>
      </div>

      {/* Faturamento */}
      <p className="text-2xl font-extrabold tabular" style={{ color: "var(--accent)" }}>
        {brl(fat)}
      </p>

      {/* Progresso */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1" style={{ color: "var(--text-muted)" }}>
          <span>Progresso médio</span>
          <span className="font-bold" style={{ color: "var(--text-primary)" }}>
            {pctMedio.toFixed(0)}%
          </span>
        </div>
        <ProgressBar pct={pctMedio} />
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-1.5">
        {(Object.entries(statusCounts) as [PlanningStatus, number][])
          .filter(([, n]) => n > 0)
          .map(([s, n]) => (
            <span
              key={s}
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: STATUS_BG[s], color: STATUS_COLOR[s], border: `1px solid ${STATUS_COLOR[s]}` }}
            >
              {n} {STATUS_OPTS.find((o) => o.value === s)?.label}
            </span>
          ))}
      </div>
    </button>
  );
}

/* ── Bottom Sheet Modal (team drill-down) ── */
function TeamModal({
  nome,
  items,
  onClose,
  onEditar,
  onExcluir,
  onConcluir,
}: {
  nome: string;
  items: PlanejamentoRow[];
  onClose: () => void;
  onEditar: (item: PlanejamentoRow) => void;
  onExcluir: (id: string) => void;
  onConcluir: (id: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="rounded-t-3xl w-full max-h-[90dvh] flex flex-col"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--border)" }} />
        </div>

        {/* Header */}
        <div className="px-5 pb-3 flex items-center justify-between border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            {nome}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold transition"
            style={{ background: "var(--bg-active)", color: "var(--text-muted)" }}
          >
            ×
          </button>
        </div>

        {/* Items */}
        <div className="overflow-y-auto flex-1">
          {items.map((item) => {
            const cor = STATUS_COLOR[item.status];
            const bg  = STATUS_BG[item.status];
            const fat = item.faturamento_planejado ?? faturamentoPlanejado(item.quantidade_prevista, item.atividades);
            return (
              <div
                key={item.id}
                className="px-5 py-4 border-b"
                style={{ borderColor: "var(--border)" }}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>
                      {item.atividades?.nome ?? "Atividade"}
                    </p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>
                      {item.projetos?.nome} · Talhão {item.talhao}
                    </p>
                  </div>
                  <span
                    className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: bg, color: cor, border: `1px solid ${cor}` }}
                  >
                    {STATUS_OPTS.find((o) => o.value === item.status)?.label}
                  </span>
                </div>

                {/* Details row */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-2">
                  <span style={{ color: "var(--text-muted)" }}>
                    Prazo: <b style={{ color: "var(--text-primary)" }}>{ddmmyyyy(item.data_limite)}</b>
                  </span>
                  {item.quantidade_prevista != null && item.atividades && (
                    <span style={{ color: "var(--text-muted)" }}>
                      Prev.: <b style={{ color: "var(--text-primary)" }}>
                        {num(item.quantidade_prevista, 1)} {item.atividades.unidade}
                      </b>
                    </span>
                  )}
                  <span style={{ color: "var(--text-muted)" }}>
                    Fat.: <b style={{ color: "var(--accent)" }}>{brl(fat)}</b>
                  </span>
                  {item.pct_realizado > 0 && (
                    <span style={{ color: "var(--text-muted)" }}>
                      Realiz.: <b style={{ color: "var(--text-primary)" }}>{item.pct_realizado.toFixed(1)}%</b>
                    </span>
                  )}
                </div>

                {item.pct_realizado > 0 && <ProgressBar pct={item.pct_realizado} />}

                {/* Action buttons */}
                <div className="flex gap-2 mt-3">
                  {!["concluido", "cancelado"].includes(item.status) && (
                    <button
                      onClick={() => onConcluir(item.id)}
                      className="px-3 py-1.5 rounded-xl border text-xs font-bold"
                      style={{ borderColor: "var(--success)", color: "var(--success)" }}
                    >
                      ✓ Concluir
                    </button>
                  )}
                  <button
                    onClick={() => onEditar(item)}
                    className="px-3 py-1.5 rounded-xl border text-xs font-bold"
                    style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
                  >
                    ✎ Editar
                  </button>
                  <button
                    onClick={() => onExcluir(item.id)}
                    className="px-3 py-1.5 rounded-xl border text-xs font-bold"
                    style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
                  >
                    🗑 Excluir
                  </button>
                </div>
              </div>
            );
          })}
          <div className="h-6" />
        </div>
      </div>
    </div>
  );
}

/* ── Form Modal ── */
function FormModal({
  editing,
  setEditing,
  projetos,
  atividades,
  equipes,
  onSalvar,
  onCancelar,
}: {
  editing: Partial<Planejamento>;
  setEditing: (v: Partial<Planejamento>) => void;
  projetos: Projeto[];
  atividades: Atividade[];
  equipes: Equipe[];
  onSalvar: () => void;
  onCancelar: () => void;
}) {
  const now = new Date();
  const atividadeSelecionada = atividades.find((a) => a.id === editing.atividade_id);
  const faturamentoEditing = faturamentoPlanejado(editing.quantidade_prevista, atividadeSelecionada);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end md:items-center md:justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => e.target === e.currentTarget && onCancelar()}
    >
      <div
        className="rounded-t-3xl md:rounded-2xl w-full md:max-w-2xl max-h-[95dvh] flex flex-col"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
      >
        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--border)" }} />
        </div>

        <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            {editing.id ? "Editar planejamento" : "Novo planejamento"}
          </h2>
          <button
            type="button"
            onClick={onCancelar}
            className="w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold"
            style={{ background: "var(--bg-active)", color: "var(--text-muted)" }}
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Input
              label="Ano"
              type="number"
              value={String(editing.ano ?? now.getFullYear())}
              onChange={(e) => setEditing({ ...editing, ano: Number(e.target.value) })}
            />
            <Input
              label="Mês"
              type="number"
              min="1"
              max="12"
              value={String(editing.mes ?? now.getMonth() + 1)}
              onChange={(e) => setEditing({ ...editing, mes: Number(e.target.value) })}
            />
            <Select
              label="Projeto"
              value={editing.projeto_id ?? ""}
              onChange={(e) => setEditing({ ...editing, projeto_id: e.target.value })}
              options={projetos.map((p) => ({ value: p.id, label: p.nome }))}
              placeholder="Selecione…"
            />
            <Input
              label="Talhão"
              value={editing.talhao ?? ""}
              onChange={(e) => setEditing({ ...editing, talhao: e.target.value })}
              placeholder="Ex.: 017-01"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Atividade"
              value={editing.atividade_id ?? ""}
              onChange={(e) => setEditing({ ...editing, atividade_id: e.target.value })}
              options={atividades.map((a) => ({ value: a.id, label: a.nome }))}
              placeholder="Selecione…"
            />
            <Select
              label="Equipe"
              value={editing.equipe_id ?? ""}
              onChange={(e) => setEditing({ ...editing, equipe_id: e.target.value || null })}
              options={equipes.map((e) => ({ value: e.id, label: e.nome }))}
              placeholder="Opcional"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Input
              label={`Produção${atividadeSelecionada ? ` (${atividadeSelecionada.unidade})` : ""}`}
              type="number"
              step="0.01"
              value={editing.quantidade_prevista == null ? "" : String(editing.quantidade_prevista)}
              onChange={(e) =>
                setEditing({ ...editing, quantidade_prevista: e.target.value ? Number(e.target.value) : null })
              }
            />
            <div
              className="rounded-xl px-3 py-2 flex flex-col justify-center"
              style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent)" }}
            >
              <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                Faturamento
              </p>
              <p className="text-base font-extrabold tabular" style={{ color: "var(--accent)" }}>
                {brl(faturamentoEditing)}
              </p>
            </div>
            <Select
              label="Status"
              value={editing.status ?? "planejado"}
              onChange={(e) => setEditing({ ...editing, status: e.target.value as PlanningStatus })}
              options={STATUS_OPTS}
            />
            <Input
              label="Início previsto"
              type="date"
              value={editing.data_inicio ?? ""}
              onChange={(e) => setEditing({ ...editing, data_inicio: e.target.value || null })}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Prazo final *"
              type="date"
              value={editing.data_limite ?? ""}
              onChange={(e) => setEditing({ ...editing, data_limite: e.target.value })}
            />
            <Input
              label="Observações"
              value={editing.observacoes ?? ""}
              onChange={(e) => setEditing({ ...editing, observacoes: e.target.value })}
            />
          </div>
        </div>

        <div className="px-5 py-4 flex gap-2 justify-end border-t" style={{ borderColor: "var(--border)" }}>
          <Button variant="ghost" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button onClick={onSalvar}>
            {editing.id ? "Salvar alterações" : "Adicionar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Sem equipe Card (itens sem equipe atribuída) ── */
const SEM_EQUIPE_ID = "__sem_equipe__";

/* ── Main Page ── */
export default function PlanejamentoAdminPage() {
  const { toast } = useToast();
  const now = new Date();

  const [items,      setItems]      = useState<PlanejamentoRow[]>([]);
  const [projetos,   setProjetos]   = useState<Projeto[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [equipes,    setEquipes]    = useState<Equipe[]>([]);
  const [loading,    setLoading]    = useState(true);

  // Filters
  const [anoFiltro,     setAnoFiltro]     = useState(String(now.getFullYear()));
  const [mesFiltro,     setMesFiltro]     = useState(String(now.getMonth() + 1));
  const [projetoFiltro, setProjetoFiltro] = useState("");
  const [statusFiltro,  setStatusFiltro]  = useState("");
  const [visualizacao, setVisualizacao] = useState<PlanejamentoView>("timeline");
  const [timelineGroupBy, setTimelineGroupBy] = useState<TimelineGroupBy>("equipe");

  // Modal states
  const [teamModal,    setTeamModal]    = useState<string | null>(null); // equipe_id or SEM_EQUIPE_ID
  const [showForm,     setShowForm]     = useState(false);
  const [editing,      setEditing]      = useState<Partial<Planejamento>>({
    ano: now.getFullYear(),
    mes: now.getMonth() + 1,
    status: "planejado",
    data_limite: hoje(),
  });

  async function carregar() {
    setLoading(true);
    try {
      const [pr, ar, er, pl] = await Promise.all([
        fetch("/api/projetos").then((r) => r.json()),
        fetch("/api/atividades").then((r) => r.json()),
        fetch("/api/equipes").then((r) => r.json()),
        fetch("/api/planejamento", { cache: "no-store" }).then((r) => r.json()),
      ]);
      setProjetos(Array.isArray(pr.items)   ? pr.items   : []);
      setAtividades(Array.isArray(ar.items) ? ar.items   : []);
      setEquipes(Array.isArray(er.items)    ? er.items   : []);
      setItems(Array.isArray(pl.items)      ? pl.items   : []);
    } catch (err) {
      toast(`Erro ao carregar: ${(err as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function novoForm() {
    setEditing({
      ano: now.getFullYear(),
      mes: now.getMonth() + 1,
      status: "planejado",
      data_limite: hoje(),
    });
    setTeamModal(null);
    setShowForm(true);
  }

  async function salvar() {
    if (!editing.ano || !editing.mes || !editing.projeto_id || !editing.talhao ||
        !editing.atividade_id || !editing.data_limite) {
      toast("Preencha mês, projeto, talhão, atividade e prazo.", "error");
      return;
    }
    const url    = editing.id ? `/api/planejamento/${editing.id}` : "/api/planejamento";
    const method = editing.id ? "PATCH" : "POST";
    const r = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(editing),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast(`Erro: ${j.error ?? r.statusText}`, "error");
      return;
    }
    toast("Planejamento salvo.", "success");
    setShowForm(false);
    carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este item de planejamento?")) return;
    const r = await fetch(`/api/planejamento/${id}`, { method: "DELETE" });
    if (!r.ok) { toast("Erro ao excluir.", "error"); return; }
    toast("Excluído.", "success");
    setTeamModal(null);
    carregar();
  }

  async function concluir(id: string) {
    const r = await fetch(`/api/planejamento/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "concluido" }),
    });
    if (!r.ok) { toast("Erro.", "error"); return; }
    toast("Concluído.", "success");
    carregar();
  }

  function handleEditar(item: PlanejamentoRow) {
    setEditing(item);
    setTeamModal(null);
    setShowForm(true);
  }

  /* ── Derived data ── */
  const itensFiltrados = useMemo(() => {
    return items.filter((item) => {
      if (anoFiltro     && String(item.ano)   !== anoFiltro)     return false;
      if (mesFiltro     && String(item.mes)   !== mesFiltro)     return false;
      if (projetoFiltro && item.projeto_id    !== projetoFiltro) return false;
      if (statusFiltro  && item.status        !== statusFiltro)  return false;
      return true;
    });
  }, [items, anoFiltro, mesFiltro, projetoFiltro, statusFiltro]);

  const faturamentoTotal = itensFiltrados.reduce(
    (s, i) => s + (i.faturamento_planejado ?? faturamentoPlanejado(i.quantidade_prevista, i.atividades)),
    0,
  );
  const nPlanejado  = itensFiltrados.filter((i) => i.status === "planejado").length;
  const nExecucao   = itensFiltrados.filter((i) => i.status === "em_execucao").length;
  const nConcluido  = itensFiltrados.filter((i) => i.status === "concluido").length;

  // Group by equipe
  const equipeGroups = useMemo(() => {
    const groups: Record<string, { nome: string; items: PlanejamentoRow[] }> = {};
    itensFiltrados.forEach((item) => {
      const key  = item.equipe_id ?? SEM_EQUIPE_ID;
      const nome = item.equipes?.nome ?? "Sem equipe";
      if (!groups[key]) groups[key] = { nome, items: [] };
      groups[key].items.push(item);
    });
    // Sort: named equipes first (by name), then "sem equipe"
    return Object.entries(groups).sort(([ka, a], [kb, b]) => {
      if (ka === SEM_EQUIPE_ID) return 1;
      if (kb === SEM_EQUIPE_ID) return -1;
      return a.nome.localeCompare(b.nome);
    });
  }, [itensFiltrados]);

  const teamModalData = teamModal
    ? equipeGroups.find(([key]) => key === teamModal)
    : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            Planejamento
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            Visão por equipe · {MESES[(Number(mesFiltro) || now.getMonth() + 1) - 1]}/{anoFiltro}
          </p>
        </div>
        <Button className="w-full sm:w-auto" onClick={novoForm}>
          + Novo planejamento
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Planejados",  value: nPlanejado,           color: "var(--accent)"        },
          { label: "Em execução", value: nExecucao,             color: "var(--warn)"          },
          { label: "Concluídos",  value: nConcluido,            color: "var(--success)"       },
          { label: "Fat. total",  value: brl(faturamentoTotal), color: "var(--text-primary)"  },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl p-3 text-center"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <p className="text-lg font-extrabold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          type="number"
          value={anoFiltro}
          onChange={(e) => setAnoFiltro(e.target.value)}
          className="h-11 w-24 rounded-xl border px-3 text-sm font-semibold"
          style={{ background: "var(--bg-card)", color: "var(--text-primary)", borderColor: "var(--border)" }}
          placeholder="Ano"
        />
        <select
          value={mesFiltro}
          onChange={(e) => setMesFiltro(e.target.value)}
          className="h-11 rounded-xl border px-3 text-xs font-semibold"
          style={{ background: "var(--bg-card)", color: "var(--text-primary)", borderColor: "var(--border)" }}
        >
          <option value="">Todos os meses</option>
          {MESES.map((m, i) => (
            <option key={i + 1} value={String(i + 1)}>{m}</option>
          ))}
        </select>
        <select
          value={projetoFiltro}
          onChange={(e) => setProjetoFiltro(e.target.value)}
          className="h-11 rounded-xl border px-3 text-xs font-semibold"
          style={{ background: "var(--bg-card)", color: "var(--text-primary)", borderColor: "var(--border)" }}
        >
          <option value="">Todos os projetos</option>
          {projetos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <select
          value={statusFiltro}
          onChange={(e) => setStatusFiltro(e.target.value)}
          className="h-11 rounded-xl border px-3 text-xs font-semibold"
          style={{ background: "var(--bg-card)", color: "var(--text-primary)", borderColor: "var(--border)" }}
        >
          <option value="">Todos os status</option>
          {STATUS_OPTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="grid grid-cols-2 rounded-xl p-1 sm:w-fit"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          {([
            { v: "timeline", label: "Timeline" },
            { v: "equipes", label: "Equipes" },
          ] as { v: PlanejamentoView; label: string }[]).map((option) => (
            <button
              key={option.v}
              type="button"
              onClick={() => setVisualizacao(option.v)}
              className="min-h-11 rounded-lg px-4 text-sm font-black transition"
              style={{
                background: visualizacao === option.v ? "var(--accent)" : "transparent",
                color: visualizacao === option.v ? "#fff" : "var(--text-secondary)",
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        {visualizacao === "timeline" && (
          <div
            className="grid grid-cols-2 rounded-xl p-1 sm:w-fit"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            {([
              { v: "equipe", label: "Equipe" },
              { v: "projeto", label: "Projeto" },
            ] as { v: TimelineGroupBy; label: string }[]).map((option) => (
              <button
                key={option.v}
                type="button"
                onClick={() => setTimelineGroupBy(option.v)}
                className="min-h-11 rounded-lg px-4 text-sm font-black transition"
                style={{
                  background: timelineGroupBy === option.v ? "var(--accent-subtle)" : "transparent",
                  color: timelineGroupBy === option.v ? "var(--accent)" : "var(--text-secondary)",
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Card grid */}
      {loading ? (
        <div className="py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          Carregando…
        </div>
      ) : equipeGroups.length === 0 ? (
        <div
          className="rounded-2xl py-16 text-center"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <p className="text-4xl mb-3">📋</p>
          <p className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
            Nenhum planejamento encontrado
          </p>
          <p className="text-sm mt-1 mb-4" style={{ color: "var(--text-muted)" }}>
            Crie o primeiro planejamento para começar.
          </p>
          <Button onClick={novoForm}>+ Novo planejamento</Button>
        </div>
      ) : visualizacao === "timeline" ? (
        <PlanejamentoTimeline
          items={itensFiltrados}
          groupBy={timelineGroupBy}
          onEditar={handleEditar}
          onConcluir={concluir}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {equipeGroups.map(([key, group]) => (
            <TeamCard
              key={key}
              nome={group.nome}
              items={group.items}
              onClick={() => setTeamModal(key)}
            />
          ))}
        </div>
      )}

      {/* Team Modal */}
      {teamModal && teamModalData && (
        <TeamModal
          nome={teamModalData[1].nome}
          items={teamModalData[1].items}
          onClose={() => setTeamModal(null)}
          onEditar={handleEditar}
          onExcluir={excluir}
          onConcluir={concluir}
        />
      )}

      {/* Form Modal */}
      {showForm && (
        <FormModal
          editing={editing}
          setEditing={setEditing}
          projetos={projetos}
          atividades={atividades}
          equipes={equipes}
          onSalvar={salvar}
          onCancelar={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
