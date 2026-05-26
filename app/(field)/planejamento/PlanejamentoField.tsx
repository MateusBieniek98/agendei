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
          Atividades planejadas para sua equipe
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
        <div className="space-y-3">
          {itensFiltrados.map((item) => (
            <CardItem key={item.id} item={item} onIniciar={handleIniciar} />
          ))}
        </div>
      )}
    </div>
  );
}
