"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import PageHeader from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { brl, ddmmyyyy, num, todayISO } from "@/lib/format";
import type { Atividade, Equipe, Planejamento, PlanningStatus, ProjetoComTalhoes } from "@/lib/types";

/* ── Types ─────────────────────────────────────────────── */
type PlanejamentoRow = Planejamento & {
  projetos:   { nome: string } | null;
  atividades: { nome: string; unidade: string; valor_unitario: number } | null;
  equipes:    { nome: string } | null;
  quantidade_realizada:   number;
  pct_realizado:          number;
  faturamento_planejado:  number;
  quantidade_realizada_os_atual: number;
  faturamento_realizado_os_atual: number;
  os_atual_inicio:        string | null;
  data_fechamento:        string | null;
  insumos_utilizados:     { nome: string; quantidade: number }[];
};

const STATUS_OPTS: { value: PlanningStatus; label: string }[] = [
  { value: "planejado",   label: "Planejado"   },
  { value: "em_execucao", label: "Em execução" },
  { value: "concluido",   label: "Concluído"   },
  { value: "cancelado",   label: "Cancelado"   },
];

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function hoje() { return todayISO(); }

function faturamentoPlanejado(
  qtd: number | null | undefined,
  atividade: { valor_unitario: number } | null | undefined,
) {
  return Number(qtd ?? 0) * Number(atividade?.valor_unitario ?? 0);
}

function normalizarTalhao(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

function mergeInsumos(items: PlanejamentoRow[]) {
  const mapa = new Map<string, { nome: string; quantidade: number }>();

  for (const item of items) {
    for (const insumo of item.insumos_utilizados ?? []) {
      const nome = String(insumo.nome ?? "").trim();
      if (!nome) continue;
      const key = nome.toUpperCase();
      const atual = mapa.get(key);
      mapa.set(key, {
        nome: atual?.nome ?? nome,
        quantidade: (atual?.quantidade ?? 0) + Number(insumo.quantidade ?? 0),
      });
    }
  }

  return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

type TalhaoGroup = {
  key: string;
  projeto: string;
  talhao: string;
  items: PlanejamentoRow[];
  quantidadePrevista: number;
  quantidadeRealizada: number;
  quantidadeRealizadaOsAtual: number;
  faturamentoPlanejado: number;
  faturamentoRealizado: number;
  faturamentoRealizadoOsAtual: number;
  osAtualInicio: string | null;
  pct: number;
  fechado: boolean;
  dataFechamento: string | null;
  insumos: { nome: string; quantidade: number }[];
};

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
  projetos: ProjetoComTalhoes[];
  atividades: Atividade[];
  equipes: Equipe[];
  onSalvar: () => void;
  onCancelar: () => void;
}) {
  const now = new Date();
  const atividadeSelecionada = atividades.find((a) => a.id === editing.atividade_id);
  const projetoSelecionado = projetos.find((p) => p.id === editing.projeto_id);
  const talhoesDoProjeto = (projetoSelecionado?.talhoes ?? []).filter((talhao) => talhao.ativo);
  const talhoesListId = `talhoes-planejamento-${editing.projeto_id ?? "todos"}`;
  const faturamentoEditing = faturamentoPlanejado(editing.quantidade_prevista, atividadeSelecionada);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end md:items-center md:justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => e.target === e.currentTarget && onCancelar()}
    >
      <div
        className="flex max-h-[95dvh] w-full flex-col rounded-t-lg md:max-w-2xl md:rounded-lg"
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
            className="flex h-8 w-8 items-center justify-center rounded-lg text-lg font-bold"
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
              onChange={(e) => setEditing({ ...editing, projeto_id: e.target.value, talhao: "" })}
              options={projetos.map((p) => ({ value: p.id, label: p.nome }))}
              placeholder="Selecione…"
            />
            <div>
              <Input
                label="Talhão"
                value={editing.talhao ?? ""}
                onChange={(e) => setEditing({ ...editing, talhao: e.target.value })}
                placeholder={talhoesDoProjeto.length > 0 ? "Selecione ou digite" : "Ex.: 017-01"}
                list={talhoesListId}
              />
              <datalist id={talhoesListId}>
                {talhoesDoProjeto.map((talhao) => (
                  <option key={talhao.id} value={talhao.codigo}>
                    {talhao.area_ha != null ? `${num(talhao.area_ha, 3)} ha` : talhao.codigo}
                  </option>
                ))}
              </datalist>
            </div>
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
              className="flex flex-col justify-center rounded-lg px-3 py-2"
              style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent)" }}
            >
              <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                Faturamento
              </p>
              <p className="text-base font-bold tabular" style={{ color: "var(--accent)" }}>
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

function TalhaoSettlementPanel({
  groups,
  onEditar,
  onExcluir,
  onConcluir,
}: {
  groups: TalhaoGroup[];
  onEditar: (item: PlanejamentoRow) => void;
  onExcluir: (id: string) => void;
  onConcluir: (id: string) => void;
}) {
  const fechados = groups.filter((group) => group.fechado).length;
  const abertos = groups.length - fechados;

  return (
    <section
      className="overflow-hidden rounded-lg"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <div className="p-4 border-b sm:p-5" style={{ borderColor: "var(--border)" }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              Fechamento por projeto e talhão
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Consolida planejado, realizado total, realizado na OS atual e insumos utilizados.
            </p>
          </div>
          <div className="flex gap-2 text-xs font-bold">
            <span
              className="rounded-md px-2 py-1"
              style={{ background: "var(--success-bg)", color: "var(--success)" }}
            >
              {fechados} fechados
            </span>
            <span
              className="rounded-md px-2 py-1"
              style={{ background: "var(--warn-bg)", color: "var(--warn)" }}
            >
              {abertos} em aberto
            </span>
          </div>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="p-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          Nenhum projeto/talhão encontrado nos filtros atuais.
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {groups.map((group) => (
            <details key={group.key} className="group open:bg-black/[0.02]">
              <summary className="cursor-pointer list-none p-4 sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                        {group.projeto} · Talhão {group.talhao}
                      </h3>
                      <span
                        className="rounded-md px-2 py-0.5 text-xs font-bold"
                        style={{
                          background: group.fechado ? "var(--success-bg)" : "var(--warn-bg)",
                          color: group.fechado ? "var(--success)" : "var(--warn)",
                        }}
                      >
                        {group.fechado ? "fechado" : "em aberto"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                      {group.items.length} atividade{group.items.length !== 1 ? "s" : ""} planejada
                      {group.dataFechamento ? ` · fechado em ${ddmmyyyy(group.dataFechamento)}` : ""}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 xl:grid-cols-6 lg:min-w-[840px]">
                    <div>
                      <p className="text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>Previsto</p>
                      <p className="font-bold tabular" style={{ color: "var(--text-primary)" }}>
                        {num(group.quantidadePrevista, 2)} ha
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>Realizado</p>
                      <p className="font-bold tabular" style={{ color: "var(--accent)" }}>
                        {num(group.quantidadeRealizada, 2)} ha
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>Área OS</p>
                      <p className="font-bold tabular" style={{ color: "var(--accent)" }}>
                        {num(group.quantidadeRealizadaOsAtual, 2)} ha
                      </p>
                      <p className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
                        {group.osAtualInicio ? `desde ${ddmmyyyy(group.osAtualInicio)}` : "OS atual"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>Planejado</p>
                      <p className="font-bold tabular" style={{ color: "var(--text-primary)" }}>
                        {brl(group.faturamentoPlanejado)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>Realizado</p>
                      <p className="font-bold tabular" style={{ color: "var(--success)" }}>
                        {brl(group.faturamentoRealizado)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>Fat. OS</p>
                      <p className="font-bold tabular" style={{ color: "var(--success)" }}>
                        {brl(group.faturamentoRealizadoOsAtual)}
                      </p>
                      <p className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
                        {group.osAtualInicio ? `desde ${ddmmyyyy(group.osAtualInicio)}` : "OS atual"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                    <span>{group.pct.toFixed(1)}% concluído</span>
                    <span className="group-open:hidden">ver detalhes</span>
                    <span className="hidden group-open:inline">recolher</span>
                  </div>
                  <ProgressBar pct={group.pct} />
                </div>
              </summary>

              <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
                  <div
                    className="rounded-lg p-3"
                    style={{ background: "var(--bg-active)", border: "1px solid var(--border)" }}
                  >
                    <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                      Atividades do talhão
                    </p>
                    <div className="mt-2 space-y-2">
                      {group.items.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-lg p-3 text-xs"
                          style={{
                            background: "var(--bg-card)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="font-bold" style={{ color: "var(--text-primary)" }}>
                                {item.atividades?.nome ?? "Atividade"}
                              </p>
                              <p className="mt-1" style={{ color: "var(--text-muted)" }}>
                                {STATUS_OPTS.find((status) => status.value === item.status)?.label} ·
                                {" "}prev. {num(Number(item.quantidade_prevista ?? 0), 2)}
                                {" "}· real. {num(Number(item.quantidade_realizada ?? 0), 2)}
                                {item.data_fechamento ? ` · fechado em ${ddmmyyyy(item.data_fechamento)}` : ""}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2 sm:justify-end">
                              {item.status !== "concluido" && (
                                <button
                                  type="button"
                                  onClick={() => onConcluir(String(item.id))}
                                  className="rounded-lg px-3 py-2 text-xs font-bold"
                                  style={{
                                    background: "var(--success-bg)",
                                    color: "var(--success)",
                                    border: "1px solid var(--success)",
                                  }}
                                >
                                  Concluir
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onEditar(item)}
                                className="rounded-lg px-3 py-2 text-xs font-bold"
                                style={{
                                  background: "var(--bg-active)",
                                  color: "var(--accent)",
                                  border: "1px solid var(--accent)",
                                }}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => onExcluir(String(item.id))}
                                className="rounded-lg px-3 py-2 text-xs font-bold"
                                style={{
                                  background: "var(--danger-bg)",
                                  color: "var(--danger)",
                                  border: "1px solid var(--danger)",
                                }}
                              >
                                Excluir
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div
                    className="rounded-lg p-3"
                    style={{ background: "var(--bg-active)", border: "1px solid var(--border)" }}
                  >
                    <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                      Insumos utilizados no talhão
                    </p>
                    {group.insumos.length === 0 ? (
                      <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                        Nenhum insumo apontado para este talhão.
                      </p>
                    ) : (
                      <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                        {group.insumos.map((insumo) => (
                          <div key={insumo.nome} className="flex justify-between gap-3">
                            <span className="truncate" style={{ color: "var(--text-secondary)" }}>
                              {insumo.nome}
                            </span>
                            <b className="shrink-0 tabular" style={{ color: "var(--text-primary)" }}>
                              {num(insumo.quantidade, 2)}
                            </b>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── Main Page ── */
export default function PlanejamentoAdminPage() {
  const { toast } = useToast();
  const now = new Date();

  const [items,      setItems]      = useState<PlanejamentoRow[]>([]);
  const [projetos,   setProjetos]   = useState<ProjetoComTalhoes[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [equipes,    setEquipes]    = useState<Equipe[]>([]);
  const [loading,    setLoading]    = useState(true);

  // Filters
  const [anoFiltro,     setAnoFiltro]     = useState(String(now.getFullYear()));
  const [mesFiltro,     setMesFiltro]     = useState(String(now.getMonth() + 1));
  const [projetoFiltro, setProjetoFiltro] = useState("");
  const [statusFiltro,  setStatusFiltro]  = useState("");

  // Modal states
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
        fetch("/api/projetos?include_talhoes=1").then((r) => r.json()),
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
  const talhaoGroups = useMemo(() => {
    const groups = new Map<string, TalhaoGroup>();

    for (const item of itensFiltrados) {
      const projeto = item.projetos?.nome ?? "Projeto não informado";
      const talhao = String(item.talhao ?? "").trim() || "Sem talhão";
      const key = `${item.projeto_id ?? projeto}|${normalizarTalhao(talhao)}`;
      const atual = groups.get(key) ?? {
        key,
        projeto,
        talhao,
        items: [],
        quantidadePrevista: 0,
        quantidadeRealizada: 0,
        quantidadeRealizadaOsAtual: 0,
        faturamentoPlanejado: 0,
        faturamentoRealizado: 0,
        faturamentoRealizadoOsAtual: 0,
        osAtualInicio: null,
        pct: 0,
        fechado: false,
        dataFechamento: null,
        insumos: [],
      };

      atual.items.push(item);
      atual.quantidadePrevista += Number(item.quantidade_prevista ?? 0);
      atual.quantidadeRealizada += Number(item.quantidade_realizada ?? 0);
      atual.quantidadeRealizadaOsAtual += Number(item.quantidade_realizada_os_atual ?? 0);
      atual.faturamentoPlanejado += Number(
        item.faturamento_planejado ?? faturamentoPlanejado(item.quantidade_prevista, item.atividades),
      );
      atual.faturamentoRealizado += Number(item.quantidade_realizada ?? 0) * Number(item.atividades?.valor_unitario ?? 0);
      atual.faturamentoRealizadoOsAtual += Number(item.faturamento_realizado_os_atual ?? 0);
      if (item.os_atual_inicio && (!atual.osAtualInicio || item.os_atual_inicio < atual.osAtualInicio)) {
        atual.osAtualInicio = item.os_atual_inicio;
      }
      if (item.data_fechamento && (!atual.dataFechamento || item.data_fechamento > atual.dataFechamento)) {
        atual.dataFechamento = item.data_fechamento;
      }

      groups.set(key, atual);
    }

    return Array.from(groups.values())
      .map((group) => {
        const pct = group.quantidadePrevista > 0
          ? (group.quantidadeRealizada / group.quantidadePrevista) * 100
          : 0;
        const fechado = group.items.length > 0 && group.items.every((item) => {
          return item.status === "concluido" || Number(item.pct_realizado ?? 0) >= 100;
        });
        return {
          ...group,
          pct,
          fechado,
          insumos: mergeInsumos(group.items),
        };
      })
      .sort((a, b) => (
        a.projeto.localeCompare(b.projeto, "pt-BR") ||
        a.talhao.localeCompare(b.talhao, "pt-BR", { numeric: true })
      ));
  }, [itensFiltrados]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <PageHeader
        eyebrow="Planejamento"
        title="Planejamento"
        subtitle={`Visão por equipe · ${MESES[(Number(mesFiltro) || now.getMonth() + 1) - 1]}/${anoFiltro}`}
        right={
          <Button className="w-full sm:w-auto" onClick={novoForm}>
            + Novo planejamento
          </Button>
        }
      />

      {/* Stats strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(260px,380px)]">
        <div
          className="rounded-lg p-4"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Faturamento planejado
          </p>
          <p className="mt-1 text-2xl font-bold tabular" style={{ color: "var(--text-primary)" }}>
            {brl(faturamentoTotal)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          type="number"
          value={anoFiltro}
          onChange={(e) => setAnoFiltro(e.target.value)}
          className="h-10 w-24 rounded-lg border px-3 text-sm font-semibold"
          style={{ background: "var(--bg-card)", color: "var(--text-primary)", borderColor: "var(--border)" }}
          placeholder="Ano"
        />
        <select
          value={mesFiltro}
          onChange={(e) => setMesFiltro(e.target.value)}
          className="h-10 rounded-lg border px-3 text-xs font-semibold"
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
          className="h-10 rounded-lg border px-3 text-xs font-semibold"
          style={{ background: "var(--bg-card)", color: "var(--text-primary)", borderColor: "var(--border)" }}
        >
          <option value="">Todos os projetos</option>
          {projetos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <select
          value={statusFiltro}
          onChange={(e) => setStatusFiltro(e.target.value)}
          className="h-10 rounded-lg border px-3 text-xs font-semibold"
          style={{ background: "var(--bg-card)", color: "var(--text-primary)", borderColor: "var(--border)" }}
        >
          <option value="">Todos os status</option>
          {STATUS_OPTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <TalhaoSettlementPanel
        groups={talhaoGroups}
        onEditar={handleEditar}
        onExcluir={excluir}
        onConcluir={concluir}
      />

      {loading && (
        <div className="py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          Carregando…
        </div>
      )}

      {!loading && itensFiltrados.length === 0 && (
        <div
          className="rounded-lg py-12 text-center"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <p className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
            Nenhum planejamento encontrado
          </p>
          <p className="text-sm mt-1 mb-4" style={{ color: "var(--text-muted)" }}>
            Crie o primeiro planejamento para começar.
          </p>
          <Button onClick={novoForm}>+ Novo planejamento</Button>
        </div>
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
