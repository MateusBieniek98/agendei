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
  data_fechamento:        string | null;
  insumos_utilizados:     { nome: string; quantidade: number }[];
};

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

function hoje() { return todayISO(); }

function faturamentoPlanejado(
  qtd: number | null | undefined,
  atividade: { valor_unitario: number } | null | undefined,
) {
  return Number(qtd ?? 0) * Number(atividade?.valor_unitario ?? 0);
}

function resumoInsumos(insumos: { nome: string; quantidade: number }[]) {
  const principais = insumos.slice(0, 4).map((insumo) => (
    `${insumo.nome}: ${num(insumo.quantidade, 2)}`
  ));
  const restantes = insumos.length - principais.length;
  return restantes > 0 ? `${principais.join(" · ")} · +${restantes}` : principais.join(" · ");
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
                  {item.data_fechamento && (
                    <span style={{ color: "var(--text-muted)" }}>
                      Fechado em: <b style={{ color: "var(--success)" }}>{ddmmyyyy(item.data_fechamento)}</b>
                    </span>
                  )}
                </div>

                {item.pct_realizado > 0 && <ProgressBar pct={item.pct_realizado} />}

                {item.insumos_utilizados.length > 0 && (
                  <div
                    className="mt-3 rounded-xl px-3 py-2 text-xs"
                    style={{ background: "var(--bg-active)", border: "1px solid var(--border)" }}
                  >
                    <p className="font-bold" style={{ color: "var(--text-primary)" }}>
                      Insumos utilizados
                    </p>
                    <p className="mt-1 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {resumoInsumos(item.insumos_utilizados)}
                    </p>
                  </div>
                )}

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
