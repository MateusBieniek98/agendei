"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { brl, ddmmyyyy, todayISO } from "@/lib/format";
import type { PlanningStatus } from "@/lib/types";

type PlanejamentoRow = {
  id: string;
  ano: number;
  mes: number;
  projeto_id: string;
  talhao: string;
  atividade_id: string;
  equipe_id: string | null;
  quantidade_prevista: number | null;
  data_inicio: string | null;
  data_limite: string;
  status: PlanningStatus;
  observacoes: string | null;
  projetos:   { nome: string } | null;
  atividades: { nome: string; unidade: string; valor_unitario: number } | null;
  equipes:    { nome: string } | null;
  quantidade_realizada:   number;
  pct_realizado:          number;
  faturamento_planejado:  number;
};

type VisualizacaoPlanejamento = "timeline" | "lista";
type AgrupamentoTimeline = "projeto" | "equipe";

const STATUS_LABEL: Record<PlanningStatus, string> = {
  planejado:   "Planejado",
  em_execucao: "Em execução",
  concluido:   "Concluído",
  cancelado:   "Cancelado",
};

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

function hoje() { return todayISO(); }

const DAY_MS = 24 * 60 * 60 * 1000;

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

function timelineGroupLabel(item: PlanejamentoRow, groupBy: AgrupamentoTimeline) {
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
    label: STATUS_LABEL[item.status],
    color: STATUS_COLOR[item.status],
    bg: STATUS_BG[item.status],
  };
}

function ProgressBar({ pct }: { pct: number }) {
  const cor =
    pct >= 100 ? "var(--success)"
    : pct >= 70 ? "var(--accent)"
    : pct >= 40 ? "var(--warn)"
    : "var(--danger)";
  return (
    <div className="rounded-full overflow-hidden mt-2" style={{ height: 6, background: "var(--border)" }}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(pct, 100)}%`, background: cor }}
      />
    </div>
  );
}

function TimelineView({
  items,
  groupBy,
  onIniciar,
}: {
  items: PlanejamentoRow[];
  groupBy: AgrupamentoTimeline;
  onIniciar: (item: PlanejamentoRow) => void;
}) {
  const bounds = getTimelineBounds(items);
  if (!bounds) return null;

  const dayWidth = timelineDayWidth(bounds.totalDays);
  const timelineWidth = Math.max(bounds.totalDays * dayWidth, 720);
  const step = timelineMarkerStep(bounds.totalDays);
  const markerOffsets = new Set<number>();
  for (let offset = 0; offset < bounds.totalDays; offset += step) {
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
      <div className="flex flex-col gap-2 border-b pb-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--border)" }}>
        <div className="min-w-0">
          <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
            Linha do tempo
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
            const faturamento = group.items.reduce((sum, item) => sum + item.faturamento_planejado, 0);
            const mediaRealizada =
              group.items.reduce((sum, item) => sum + item.pct_realizado, 0) / group.items.length;

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
                    const width = Math.max((endOffset - startOffset + 1) * dayWidth, 128);
                    const tone = timelineTone(item);
                    const isAtivo = item.status === "planejado" || item.status === "em_execucao";
                    const previsto =
                      item.quantidade_prevista != null && item.atividades
                        ? `${item.quantidade_prevista} ${item.atividades.unidade}`
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
                                Talhão {item.talhao} · {previsto} · {item.pct_realizado.toFixed(0)}%
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span
                                className="hidden rounded-full px-2 py-0.5 text-[10px] font-black sm:inline-flex"
                                style={{ color: tone.color, border: `1px solid ${tone.color}` }}
                              >
                                {tone.label}
                              </span>
                              {isAtivo && (
                                <button
                                  type="button"
                                  onClick={() => onIniciar(item)}
                                  className="min-h-9 rounded-lg px-3 text-[11px] font-black text-white transition active:opacity-80"
                                  style={{ background: tone.color }}
                                >
                                  Lançar
                                </button>
                              )}
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

function CardItem({
  item,
  onIniciar,
}: {
  item: PlanejamentoRow;
  onIniciar: (item: PlanejamentoRow) => void;
}) {
  const cor = STATUS_COLOR[item.status];
  const bg  = STATUS_BG[item.status];
  const isAtivo = item.status === "planejado" || item.status === "em_execucao";
  const isHoje  = item.data_inicio
    ? item.data_inicio <= hoje() && hoje() <= item.data_limite
    : hoje() <= item.data_limite;

  return (
    <div
      className="rounded-2xl p-4 space-y-3 animate-fade-in"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold truncate" style={{ color: "var(--text-primary)" }}>
            {item.atividades?.nome ?? "Atividade"}
          </p>
          <p className="text-sm truncate mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {item.projetos?.nome ?? "Projeto"} · Talhão {item.talhao}
          </p>
        </div>
        <span
          className="shrink-0 text-xs font-bold px-2 py-1 rounded-full"
          style={{ background: bg, color: cor, border: `1px solid ${cor}` }}
        >
          {STATUS_LABEL[item.status]}
        </span>
      </div>

      {/* Detalhes */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p style={{ color: "var(--text-muted)" }}>Prazo</p>
          <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
            {ddmmyyyy(item.data_limite)}
          </p>
        </div>
        {item.quantidade_prevista != null && item.atividades && (
          <div>
            <p style={{ color: "var(--text-muted)" }}>Previsto</p>
            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
              {item.quantidade_prevista} {item.atividades.unidade}
            </p>
          </div>
        )}
        <div>
          <p style={{ color: "var(--text-muted)" }}>Faturamento</p>
          <p className="font-bold tabular" style={{ color: "var(--accent)" }}>
            {brl(item.faturamento_planejado)}
          </p>
        </div>
        {item.pct_realizado > 0 && (
          <div>
            <p style={{ color: "var(--text-muted)" }}>Realizado</p>
            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
              {item.pct_realizado.toFixed(1)}%
            </p>
          </div>
        )}
      </div>

      {/* Barra de progresso */}
      {item.pct_realizado > 0 && <ProgressBar pct={item.pct_realizado} />}

      {/* Observações */}
      {item.observacoes && (
        <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>
          {item.observacoes}
        </p>
      )}

      {/* Botão Iniciar */}
      {isAtivo && (
        <button
          type="button"
          onClick={() => onIniciar(item)}
          className="w-full rounded-xl py-3 text-sm font-bold text-white transition active:opacity-80"
          style={{ background: isHoje ? "var(--success)" : "var(--accent)" }}
        >
          {item.status === "em_execucao" ? "▶ Continuar atividade" : "▶ Iniciar atividade"}
        </button>
      )}
    </div>
  );
}

export default function PlanejamentoField({
  equipeId,
}: {
  equipeId: string | null;
}) {
  const router = useRouter();
  const [items,   setItems]   = useState<PlanejamentoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro,  setFiltro]  = useState<"todos" | "hoje" | "pendentes">("hoje");
  const [visualizacao, setVisualizacao] = useState<VisualizacaoPlanejamento>("timeline");
  const [agruparPor, setAgruparPor] = useState<AgrupamentoTimeline>("projeto");

  const carregar = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const url = equipeId
        ? `/api/planejamento?equipe_id=${equipeId}`
        : "/api/planejamento";
      const r = await fetch(url, { cache: "no-store" });
      const j = await r.json();
      setItems(Array.isArray(j.items) ? j.items : []);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [equipeId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    const atualizarSeVisivel = () => {
      if (document.visibilityState === "visible") carregar(true);
    };
    window.addEventListener("focus", atualizarSeVisivel);
    document.addEventListener("visibilitychange", atualizarSeVisivel);
    const timer = window.setInterval(atualizarSeVisivel, 30000);
    return () => {
      window.removeEventListener("focus", atualizarSeVisivel);
      document.removeEventListener("visibilitychange", atualizarSeVisivel);
      window.clearInterval(timer);
    };
  }, [carregar]);

  const hoje_str = hoje();

  const itensFiltrados = useMemo(() => {
    const ativos = items.filter((i) => i.status !== "cancelado");
    if (filtro === "hoje") {
      return ativos.filter((i) => {
        const start = i.data_inicio ?? i.data_limite;
        return start <= hoje_str && hoje_str <= i.data_limite;
      });
    }
    if (filtro === "pendentes") {
      return ativos.filter((i) => i.status !== "concluido");
    }
    return ativos;
  }, [items, filtro, hoje_str]);

  const totalHoje      = items.filter((i) => {
    if (i.status === "cancelado") return false;
    const start = i.data_inicio ?? i.data_limite;
    return start <= hoje_str && hoje_str <= i.data_limite;
  }).length;
  const totalPendentes = items.filter((i) => i.status !== "cancelado" && i.status !== "concluido").length;

  function handleIniciar(item: PlanejamentoRow) {
    const params = new URLSearchParams();
    if (item.atividade_id) params.set("atividade_id", item.atividade_id);
    if (item.projeto_id)   params.set("projeto_id",   item.projeto_id);
    if (item.talhao)       params.set("talhao",        item.talhao);
    router.push(`/lancamento?${params.toString()}`);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          Planejamento
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
          Linha do tempo e atividades planejadas para sua equipe
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {([
          { v: "hoje",      label: `Hoje (${totalHoje})` },
          { v: "pendentes", label: `Pendentes (${totalPendentes})` },
          { v: "todos",     label: "Todos" },
        ] as { v: typeof filtro; label: string }[]).map((f) => (
          <button
            key={f.v}
            onClick={() => setFiltro(f.v)}
            className="min-h-11 px-4 py-2 rounded-xl text-sm font-bold transition"
            style={{
              background: filtro === f.v ? "var(--accent)" : "var(--bg-card)",
              color:      filtro === f.v ? "#fff" : "var(--text-secondary)",
              border:     `1px solid ${filtro === f.v ? "var(--accent)" : "var(--border)"}`,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="grid grid-cols-2 rounded-xl p-1 sm:w-fit"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          {([
            { v: "timeline", label: "Timeline" },
            { v: "lista", label: "Lista" },
          ] as { v: VisualizacaoPlanejamento; label: string }[]).map((option) => (
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
              { v: "projeto", label: "Projeto" },
              { v: "equipe", label: "Equipe" },
            ] as { v: AgrupamentoTimeline; label: string }[]).map((option) => (
              <button
                key={option.v}
                type="button"
                onClick={() => setAgruparPor(option.v)}
                className="min-h-11 rounded-lg px-4 text-sm font-black transition"
                style={{
                  background: agruparPor === option.v ? "var(--accent-subtle)" : "transparent",
                  color: agruparPor === option.v ? "var(--accent)" : "var(--text-secondary)",
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          Carregando…
        </div>
      ) : itensFiltrados.length === 0 ? (
        <div
          className="rounded-2xl py-12 text-center"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <p className="text-3xl mb-2">📋</p>
          <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
            {filtro === "hoje"
              ? "Nenhuma atividade planejada para hoje."
              : filtro === "pendentes"
              ? "Nenhuma atividade pendente."
              : "Nenhum item de planejamento encontrado."}
          </p>
        </div>
      ) : (
        visualizacao === "timeline" ? (
          <TimelineView items={itensFiltrados} groupBy={agruparPor} onIniciar={handleIniciar} />
        ) : (
          <div className="space-y-3">
            {itensFiltrados.map((item) => (
              <CardItem key={item.id} item={item} onIniciar={handleIniciar} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
