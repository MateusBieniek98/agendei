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

const STATUS_OPTS: { value: PlanningStatus; label: string }[] = [
  { value: "planejado",    label: "Planejado"    },
  { value: "em_execucao",  label: "Em execução"  },
  { value: "concluido",    label: "Concluído"    },
  { value: "cancelado",    label: "Cancelado"    },
];

const STATUS_COLORS: Record<PlanningStatus, string> = {
  planejado:   "var(--accent)",
  em_execucao: "var(--warn)",
  concluido:   "var(--success)",
  cancelado:   "var(--text-muted)",
};

const STATUS_BG: Record<PlanningStatus, string> = {
  planejado:   "var(--accent-subtle)",
  em_execucao: "var(--warn-bg)",
  concluido:   "var(--success-bg, #f0fdf4)",
  cancelado:   "var(--bg-page)",
};

/* ── Helpers ────────────────────────────────────────────── */
function hoje() {
  return todayISO();
}

function next7Days(): string[] {
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const tz = d.getTimezoneOffset();
    days.push(new Date(d.getTime() - tz * 60_000).toISOString().slice(0, 10));
  }
  return days;
}

function shortDay(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric" });
}

function faturamentoPlanejado(
  qtd: number | null | undefined,
  atividade: { valor_unitario: number } | null | undefined,
) {
  return Number(qtd ?? 0) * Number(atividade?.valor_unitario ?? 0);
}

/* ── Thermometer ────────────────────────────────────────── */
function Termometro({
  label,
  realizado,
  previsto,
  unidade,
}: {
  label: string;
  realizado: number;
  previsto: number;
  unidade: string;
}) {
  const pct = previsto > 0 ? Math.min((realizado / previsto) * 100, 100) : 0;
  const cor =
    pct >= 100 ? "var(--success)"
    : pct >= 70 ? "var(--accent)"
    : pct >= 40 ? "var(--warn)"
    :              "var(--danger)";

  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-2"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <p className="text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>
        {label}
      </p>
      <div className="flex items-center justify-between gap-2">
        <div
          className="flex-1 rounded-full overflow-hidden"
          style={{ height: 8, background: "var(--border)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: cor }}
          />
        </div>
        <span className="text-xs font-extrabold tabular shrink-0" style={{ color: cor }}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {num(realizado, 1)} / {num(previsto, 1)} {unidade}
      </p>
    </div>
  );
}

/* ── Timeline 7 dias ────────────────────────────────────── */
function Timeline7Dias({
  items,
  days,
}: {
  items: PlanejamentoRow[];
  days: string[];
}) {
  const N = days.length;

  // Only show items with dates overlapping the window
  const visiveis = items.filter((item) => {
    if (item.status === "cancelado") return false;
    const start = item.data_inicio ?? item.data_limite;
    const end   = item.data_limite;
    return start <= days[N - 1] && end >= days[0];
  });

  if (visiveis.length === 0) {
    return (
      <div
        className="rounded-2xl p-8 text-center text-sm"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
      >
        Nenhum item na janela dos próximos 7 dias.
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      {/* Day headers */}
      <div
        className="grid border-b"
        style={{
          gridTemplateColumns: "180px repeat(7, 1fr)",
          borderColor: "var(--border)",
        }}
      >
        <div className="px-3 py-2" />
        {days.map((d, i) => (
          <div
            key={d}
            className="px-1 py-2 text-center"
            style={{
              borderLeft: "1px solid var(--border)",
              background: d === hoje() ? "var(--accent-subtle)" : undefined,
            }}
          >
            <p className="text-xs font-bold" style={{ color: i === 0 ? "var(--accent)" : "var(--text-primary)" }}>
              {shortDay(d)}
            </p>
          </div>
        ))}
      </div>

      {/* Rows */}
      {visiveis.map((item) => {
        const start = item.data_inicio ?? item.data_limite;
        const end   = item.data_limite;

        // Clamp to visible window
        const startIdx = Math.max(0, days.findIndex(d => d >= start));
        const lastIdx  = days.findLastIndex(d => d <= end);
        const endIdx   = lastIdx < 0 ? N - 1 : Math.min(N - 1, lastIdx);

        const barLeft  = `${(startIdx / N) * 100}%`;
        const barWidth = `${((endIdx - startIdx + 1) / N) * 100}%`;
        const color    = STATUS_COLORS[item.status] ?? "var(--accent)";
        const bg       = STATUS_BG[item.status]     ?? "var(--accent-subtle)";

        return (
          <div
            key={item.id}
            className="flex border-b"
            style={{ borderColor: "var(--border)" }}
          >
            {/* Label */}
            <div className="w-[180px] shrink-0 px-3 py-2 flex flex-col justify-center border-r" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>
                {item.atividades?.nome ?? "Atividade"}
              </p>
              <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                {item.projetos?.nome ?? "Projeto"}
                {item.talhao ? ` · ${item.talhao}` : ""}
              </p>
            </div>

            {/* Bar track */}
            <div className="flex-1 relative" style={{ height: 56 }}>
              {/* Today vertical line */}
              {days.includes(hoje()) && (
                <div
                  className="absolute top-0 bottom-0 w-px pointer-events-none"
                  style={{
                    left: `${(days.indexOf(hoje()) / N) * 100}%`,
                    background: "var(--accent)",
                    opacity: 0.35,
                  }}
                />
              )}
              {/* The bar */}
              <div
                className="absolute top-2 rounded-lg flex items-center px-2 overflow-hidden"
                style={{
                  left: barLeft,
                  width: barWidth,
                  height: 36,
                  background: bg,
                  border: `1px solid ${color}`,
                }}
              >
                <div
                  className="h-1.5 rounded-full mr-2 shrink-0"
                  style={{ width: 6, background: color }}
                />
                <span className="text-xs font-semibold truncate" style={{ color }}>
                  {item.equipes?.nome ?? ""}
                  {item.pct_realizado > 0
                    ? ` ${item.pct_realizado.toFixed(0)}%`
                    : ""}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Progress bar ───────────────────────────────────────── */
function ProgressBar({ pct }: { pct: number }) {
  const cor =
    pct >= 100 ? "var(--success)"
    : pct >= 70 ? "var(--accent)"
    : pct >= 40 ? "var(--warn)"
    :              "var(--danger)";
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-xs mb-1" style={{ color: "var(--text-muted)" }}>
        <span>{pct.toFixed(1)}% realizado</span>
      </div>
      <div className="rounded-full overflow-hidden" style={{ height: 6, background: "var(--border)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(pct, 100)}%`, background: cor }}
        />
      </div>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────── */
type View = "timeline" | "lista" | "novo";

export default function PlanejamentoAdminPage() {
  const { toast } = useToast();
  const now = new Date();
  const days = useMemo(() => next7Days(), []);

  const [items,      setItems]      = useState<PlanejamentoRow[]>([]);
  const [projetos,   setProjetos]   = useState<Projeto[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [equipes,    setEquipes]    = useState<Equipe[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [view,       setView]       = useState<View>("timeline");

  // List filters
  const [busca,           setBusca]           = useState("");
  const [statusFiltro,    setStatusFiltro]    = useState("");
  const [projetoFiltro,   setProjetoFiltro]   = useState("");
  const [atividadeFiltro, setAtividadeFiltro] = useState("");
  const [equipeFiltro,    setEquipeFiltro]    = useState("");

  // Form state
  const [editing, setEditing] = useState<Partial<Planejamento>>({
    ano: now.getFullYear(),
    mes: now.getMonth() + 1,
    status: "planejado",
    data_limite: hoje(),
  });

  const atividadeSelecionada = useMemo(
    () => atividades.find((a) => a.id === editing.atividade_id),
    [atividades, editing.atividade_id],
  );

  async function carregar() {
    setLoading(true);
    try {
      const [pr, ar, er, pl] = await Promise.all([
        fetch("/api/projetos").then((r)   => r.json()),
        fetch("/api/atividades").then((r) => r.json()),
        fetch("/api/equipes").then((r)    => r.json()),
        fetch("/api/planejamento").then((r) => r.json()),
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
    novoForm();
    setView("timeline");
    carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este item?")) return;
    const r = await fetch(`/api/planejamento/${id}`, { method: "DELETE" });
    if (!r.ok) { toast("Erro ao excluir.", "error"); return; }
    toast("Excluído.", "success");
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

  /* ── Derived data ───────────────────────────────────────── */
  const faturamentoEditing = faturamentoPlanejado(editing.quantidade_prevista, atividadeSelecionada);
  const faturamentoTotal   = items.reduce(
    (s, i) => s + (i.faturamento_planejado ?? faturamentoPlanejado(i.quantidade_prevista, i.atividades)),
    0,
  );

  const nPlanejado  = items.filter((i) => i.status === "planejado").length;
  const nExecucao   = items.filter((i) => i.status === "em_execucao").length;
  const nConcluido  = items.filter((i) => i.status === "concluido").length;

  // Thermometers: group by atividade
  const termometros = useMemo(() => {
    const map: Record<string, { nome: string; unidade: string; previsto: number; realizado: number }> = {};
    items.forEach((item) => {
      if (!item.atividade_id || item.status === "cancelado") return;
      const nome     = item.atividades?.nome ?? item.atividade_id;
      const unidade  = item.atividades?.unidade ?? "un.";
      const previsto  = Number(item.quantidade_prevista ?? 0);
      const realizado = Number(item.quantidade_realizada ?? 0);
      if (!map[item.atividade_id]) {
        map[item.atividade_id] = { nome, unidade, previsto: 0, realizado: 0 };
      }
      map[item.atividade_id].previsto  += previsto;
      map[item.atividade_id].realizado += realizado;
    });
    return Object.values(map).filter((t) => t.previsto > 0);
  }, [items]);

  // List filter
  const itemsFiltrados = useMemo(() => {
    return items.filter((item) => {
      if (statusFiltro    && item.status         !== statusFiltro)    return false;
      if (projetoFiltro   && item.projeto_id      !== projetoFiltro)  return false;
      if (atividadeFiltro && item.atividade_id    !== atividadeFiltro) return false;
      if (equipeFiltro    && item.equipe_id        !== equipeFiltro)   return false;
      if (busca) {
        const q = busca.toLowerCase();
        const match =
          (item.projetos?.nome   ?? "").toLowerCase().includes(q) ||
          (item.atividades?.nome ?? "").toLowerCase().includes(q) ||
          (item.equipes?.nome    ?? "").toLowerCase().includes(q) ||
          (item.talhao           ?? "").toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [items, busca, statusFiltro, projetoFiltro, atividadeFiltro, equipeFiltro]);

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            Planejamento
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            Timeline semanal e progresso por atividade.
          </p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => { novoForm(); setView("novo"); }}>
          + Novo item
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Planejados",  value: nPlanejado,        color: "var(--accent)"   },
          { label: "Em execução", value: nExecucao,          color: "var(--warn)"    },
          { label: "Concluídos",  value: nConcluido,         color: "var(--success)" },
          { label: "Fat. total",  value: brl(faturamentoTotal), color: "var(--text-primary)" },
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

      {/* Tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: "var(--border)" }}>
        {([
          { v: "timeline", label: "📅 Timeline 7 dias" },
          { v: "lista",    label: "📋 Lista"            },
          { v: "novo",     label: editing.id ? "✏️ Editar" : "➕ Novo" },
        ] as { v: View; label: string }[]).map((t) => (
          <button
            key={t.v}
            onClick={() => { setView(t.v); if (t.v !== "novo") novoForm(); }}
            className="px-4 py-2 text-sm font-semibold border-b-2 transition-all"
            style={{
              borderColor:   view === t.v ? "var(--accent)" : "transparent",
              color:         view === t.v ? "var(--accent)" : "var(--text-muted)",
              background:    "transparent",
              marginBottom:  -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Timeline ─────────────────────────────────── */}
      {view === "timeline" && (
        <div className="space-y-5">
          {loading ? (
            <div className="text-center py-8 text-sm" style={{ color: "var(--text-muted)" }}>
              Carregando...
            </div>
          ) : (
            <>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>
                  PRÓXIMOS 7 DIAS
                </p>
                <Timeline7Dias items={items} days={days} />
              </div>

              {termometros.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>
                    TERMÔMETRO POR ATIVIDADE
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {termometros.map((t) => (
                      <Termometro
                        key={t.nome}
                        label={t.nome}
                        realizado={t.realizado}
                        previsto={t.previsto}
                        unidade={t.unidade}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Tab: Lista ────────────────────────────────────── */}
      {view === "lista" && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <input
              className="flex-1 min-w-[160px] h-9 rounded-xl border px-3 text-sm"
              style={{ background: "var(--bg-card)", color: "var(--text-primary)", borderColor: "var(--border)" }}
              placeholder="Buscar por projeto, atividade, equipe..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <select
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value)}
              className="h-9 rounded-xl border px-3 text-xs font-semibold"
              style={{ background: "var(--bg-card)", color: "var(--text-primary)", borderColor: "var(--border)" }}
            >
              <option value="">Todos os status</option>
              {STATUS_OPTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select
              value={projetoFiltro}
              onChange={(e) => setProjetoFiltro(e.target.value)}
              className="h-9 rounded-xl border px-3 text-xs font-semibold"
              style={{ background: "var(--bg-card)", color: "var(--text-primary)", borderColor: "var(--border)" }}
            >
              <option value="">Todos os projetos</option>
              {projetos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>

          {/* List */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            {loading ? (
              <div className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                Carregando...
              </div>
            ) : itemsFiltrados.length === 0 ? (
              <div className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                Nenhum item encontrado.
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {itemsFiltrados.map((item) => {
                  const cor = STATUS_COLORS[item.status];
                  const bg  = STATUS_BG[item.status];
                  return (
                    <div key={item.id} className="p-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="inline-block w-2 h-2 rounded-full shrink-0"
                            style={{ background: cor }}
                          />
                          <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                            {item.projetos?.nome ?? "Projeto"} · Talhão {item.talhao}
                          </span>
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: bg, color: cor, border: `1px solid ${cor}` }}
                          >
                            {item.status.replace("_", " ")}
                          </span>
                        </div>
                        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                          {item.atividades?.nome} · prazo {ddmmyyyy(item.data_limite)}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {item.equipes?.nome ?? "Equipe não definida"}
                          {item.quantidade_prevista != null && item.atividades
                            ? ` · previsto ${num(item.quantidade_prevista, 1)} ${item.atividades.unidade}`
                            : ""}
                        </p>
                        <p className="text-sm font-bold mt-1" style={{ color: "var(--accent)" }}>
                          {brl(item.faturamento_planejado ?? faturamentoPlanejado(item.quantidade_prevista, item.atividades))}
                        </p>
                        <ProgressBar pct={item.pct_realizado ?? 0} />
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2 md:mt-0 md:shrink-0">
                        {!["concluido", "cancelado"].includes(item.status) && (
                          <button
                            onClick={() => concluir(item.id)}
                            className="px-3 py-1.5 rounded-xl border text-xs font-bold"
                            style={{ borderColor: "var(--success)", color: "var(--success)" }}
                          >
                            Concluir
                          </button>
                        )}
                        <button
                          onClick={() => { setEditing(item); setView("novo"); }}
                          className="px-3 py-1.5 rounded-xl border text-xs font-bold"
                          style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => excluir(item.id)}
                          className="px-3 py-1.5 rounded-xl border text-xs font-bold"
                          style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Novo / Editar ────────────────────────────── */}
      {view === "novo" && (
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <h2 className="font-bold text-lg" style={{ color: "var(--text-primary)" }}>
            {editing.id ? "Editar planejamento" : "Novo planejamento"}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
            <Input
              label={`Produção prevista${atividadeSelecionada ? ` (${atividadeSelecionada.unidade})` : ""}`}
              type="number"
              step="0.01"
              value={editing.quantidade_prevista == null ? "" : String(editing.quantidade_prevista)}
              onChange={(e) =>
                setEditing({ ...editing, quantidade_prevista: e.target.value ? Number(e.target.value) : null })
              }
            />
            <div
              className="rounded-xl px-3 py-2"
              style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent)" }}
            >
              <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                Faturamento planejado
              </p>
              <p className="text-xl font-extrabold tabular" style={{ color: "var(--accent)" }}>
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
            <Input
              label="Prazo final"
              type="date"
              value={editing.data_limite ?? ""}
              onChange={(e) => setEditing({ ...editing, data_limite: e.target.value })}
            />
            <div className="sm:col-span-2">
              <Input
                label="Observações"
                value={editing.observacoes ?? ""}
                onChange={(e) => setEditing({ ...editing, observacoes: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              onClick={() => { novoForm(); setView("timeline"); }}
            >
              Cancelar
            </Button>
            <Button onClick={salvar}>
              {editing.id ? "Salvar alterações" : "Adicionar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
