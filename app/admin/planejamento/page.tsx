"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Badge from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { brl, ddmmyyyy, num } from "@/lib/format";
import type { Atividade, Equipe, Planejamento, PlanningStatus, Projeto } from "@/lib/types";

type PlanejamentoRow = Planejamento & {
  projetos: { nome: string } | null;
  atividades: { nome: string; unidade: string; valor_unitario: number } | null;
  equipes: { nome: string } | null;
  quantidade_realizada: number;
  pct_realizado: number;
  faturamento_planejado: number;
};

const STATUS_OPTS: { value: PlanningStatus; label: string }[] = [
  { value: "planejado", label: "Planejado" },
  { value: "em_execucao", label: "Em execução" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
];

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function statusBadge(status: PlanningStatus) {
  if (status === "concluido") return <Badge tone="success">concluído</Badge>;
  if (status === "em_execucao") return <Badge tone="warning">em execução</Badge>;
  if (status === "cancelado") return <Badge tone="neutral">cancelado</Badge>;
  return <Badge tone="info">planejado</Badge>;
}

function faturamentoPlanejado(
  quantidade: number | null | undefined,
  atividade: { valor_unitario: number } | null | undefined
) {
  return Number(quantidade ?? 0) * Number(atividade?.valor_unitario ?? 0);
}

function progressoWidth(pct: number | null | undefined) {
  return `${Math.min(Math.max(Number(pct ?? 0), 0), 100)}%`;
}

function PlanejamentoProgressBar({ item }: { item: PlanejamentoRow }) {
  const prevista = Number(item.quantidade_prevista ?? 0);
  const realizada = Number(item.quantidade_realizada ?? 0);
  const pct = Number(item.pct_realizado ?? 0);
  const unidade = item.atividades?.unidade ?? "un.";

  return (
    <div className="mt-3 max-w-xl">
      <div className="mb-1 flex items-center justify-between gap-3 text-xs font-bold text-[var(--color-ink-700)]">
        <span>
          Realizado: {num(realizada)} de {num(prevista)} {unidade}
        </span>
        <span className="text-[var(--color-gn-700)] tabular">
          {pct.toFixed(1)}%
        </span>
      </div>
      <div
        className="h-3 w-full overflow-hidden rounded-full bg-[var(--color-ink-100)]"
        title={`${pct.toFixed(1)}% realizado`}
      >
        <div
          className="h-full rounded-full bg-[var(--color-gn-500)] transition-all"
          style={{ width: progressoWidth(pct) }}
        />
      </div>
      {pct >= 100 && (
        <p className="mt-1 text-xs font-bold text-[var(--color-forest-700)]">
          Produção atingiu 100%; o planejamento será concluído automaticamente.
        </p>
      )}
    </div>
  );
}

export default function PlanejamentoAdminPage() {
  const { toast } = useToast();
  const now = new Date();
  const [items, setItems] = useState<PlanejamentoRow[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Planejamento>>({
    ano: now.getFullYear(),
    mes: now.getMonth() + 1,
    status: "planejado",
    data_limite: hoje(),
  });

  const atividadeSelecionada = useMemo(
    () => atividades.find((a) => a.id === editing.atividade_id),
    [atividades, editing.atividade_id]
  );

  async function carregar() {
    setLoading(true);
    try {
      const [pr, ar, er, pl] = await Promise.all([
        fetch("/api/projetos").then((r) => r.json()),
        fetch("/api/atividades").then((r) => r.json()),
        fetch("/api/equipes").then((r) => r.json()),
        fetch("/api/planejamento").then((r) => r.json()),
      ]);
      setProjetos(Array.isArray(pr.items) ? pr.items : []);
      setAtividades(Array.isArray(ar.items) ? ar.items : []);
      setEquipes(Array.isArray(er.items) ? er.items : []);
      setItems(Array.isArray(pl.items) ? pl.items : []);
    } catch (err) {
      toast(`Erro ao carregar planejamento: ${(err as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function novo() {
    setEditing({
      ano: now.getFullYear(),
      mes: now.getMonth() + 1,
      status: "planejado",
      data_limite: hoje(),
    });
  }

  async function salvar() {
    if (
      !editing.ano ||
      !editing.mes ||
      !editing.projeto_id ||
      !editing.talhao ||
      !editing.atividade_id ||
      !editing.data_limite
    ) {
      toast("Preencha mês, projeto, talhão, atividade e prazo.", "error");
      return;
    }

    const url = editing.id ? `/api/planejamento/${editing.id}` : "/api/planejamento";
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
    novo();
    carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este item do planejamento?")) return;
    const r = await fetch(`/api/planejamento/${id}`, { method: "DELETE" });
    if (!r.ok) {
      toast("Erro ao excluir.", "error");
      return;
    }
    toast("Planejamento excluído.", "success");
    carregar();
  }

  async function concluir(id: string) {
    const r = await fetch(`/api/planejamento/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "concluido" }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast(`Erro ao concluir: ${j.error ?? r.statusText}`, "error");
      return;
    }
    toast("Atividade planejada concluída.", "success");
    carregar();
  }

  const faturamentoEditing = faturamentoPlanejado(
    editing.quantidade_prevista,
    atividadeSelecionada
  );
  const faturamentoTotalPlanejado = items.reduce(
    (total, item) =>
      total +
      (item.faturamento_planejado ??
        faturamentoPlanejado(item.quantidade_prevista, item.atividades)),
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Planejamento mensal</h1>
        <p className="text-sm font-semibold text-[var(--color-ink-600)]">
          Cadastre atividades planejadas por projeto, talhão e prazo.
        </p>
      </div>

      <Card className="p-4">
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
          <div className="rounded-xl border-2 border-[var(--color-ink-200)] bg-[var(--color-ink-50)] px-3 py-2">
            <p className="text-sm font-bold text-[var(--color-ink-900)]">
              Faturamento planejado
            </p>
            <p className="mt-1 text-xl font-bold text-[var(--color-gn-700)] tabular">
              {brl(faturamentoEditing)}
            </p>
            <p className="text-xs font-semibold text-[var(--color-ink-600)]">
              tarifa × produção prevista
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
        <div className="mt-4 grid grid-cols-1 gap-2 sm:flex sm:justify-end">
          <Button variant="ghost" onClick={novo}>Limpar</Button>
          <Button onClick={salvar}>{editing.id ? "Salvar alterações" : "Adicionar ao planejamento"}</Button>
        </div>
      </Card>

      <Card className="p-5 bg-[var(--color-gn-700)] text-white border-[var(--color-gn-700)]">
        <p className="text-xs font-bold uppercase tracking-wider text-white/80">
          Faturamento total planejado
        </p>
        <p className="mt-2 text-3xl font-bold tabular">
          {brl(faturamentoTotalPlanejado)}
        </p>
        <p className="mt-1 text-sm font-semibold text-white/75">
          Soma de todos os itens cadastrados no planejamento carregado.
        </p>
      </Card>

      <Card>
        <div className="flex flex-col gap-1 border-b border-[var(--color-ink-100)] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold">
            {loading ? "Carregando…" : `${items.length} item${items.length === 1 ? "" : "s"}`}
          </p>
          <p className="text-sm font-bold text-[var(--color-gn-700)] tabular">
            Total planejado: {brl(faturamentoTotalPlanejado)}
          </p>
        </div>
        <div className="divide-y divide-[var(--color-ink-100)]">
          {items.map((item) => (
            <div key={item.id} className="p-4 flex flex-col md:flex-row md:items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-[var(--color-ink-900)]">
                    {item.projetos?.nome ?? "Projeto"} · Talhão {item.talhao}
                  </p>
                  {statusBadge(item.status)}
                </div>
                <p className="mt-1 text-sm font-semibold text-[var(--color-ink-700)]">
                  {item.atividades?.nome ?? "Atividade"} · prazo {ddmmyyyy(item.data_limite)}
                </p>
                <p className="text-xs font-semibold text-[var(--color-ink-500)]">
                  {item.equipes?.nome ?? "Equipe não definida"}
                  {item.quantidade_prevista != null && item.atividades
                    ? ` · previsto ${num(item.quantidade_prevista)} ${item.atividades.unidade}`
                    : ""}
                </p>
                <p className="mt-1 text-sm font-bold text-[var(--color-gn-700)] tabular">
                  Faturamento planejado:{" "}
                  {brl(item.faturamento_planejado ?? faturamentoPlanejado(item.quantidade_prevista, item.atividades))}
                </p>
                <PlanejamentoProgressBar item={item} />
                {item.observacoes && (
                  <p className="mt-1 text-sm text-[var(--color-ink-600)]">{item.observacoes}</p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap md:justify-end">
                {!["concluido", "cancelado"].includes(item.status) && (
                  <button
                    onClick={() => concluir(item.id)}
                    className="rounded-xl border-2 border-[var(--color-forest-700)] px-3 py-2 text-sm font-bold text-[var(--color-forest-700)]"
                  >
                    Concluir
                  </button>
                )}
                <button
                  onClick={() => setEditing(item)}
                  className="rounded-xl border-2 border-[var(--color-gn-600)] px-3 py-2 text-sm font-bold text-[var(--color-gn-700)]"
                >
                  Editar
                </button>
                <button
                  onClick={() => excluir(item.id)}
                  className="rounded-xl border-2 border-[var(--color-danger-500)] px-3 py-2 text-sm font-bold text-[var(--color-danger-500)]"
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && !loading && (
            <div className="p-6 text-center text-sm font-semibold text-[var(--color-ink-600)]">
              Nenhum planejamento cadastrado.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
