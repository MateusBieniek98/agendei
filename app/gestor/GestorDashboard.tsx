"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { Card, StatCard } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { brl, ddmmyyyy, num } from "@/lib/format";
import { LinhaChart } from "./GestorCharts";
import PeriodoFiltro, { type PeriodoState } from "@/components/dashboard/PeriodoFiltro";
import type { MachineStatus, PlanningStatus } from "@/lib/types";

type Aba = "faturamento" | "manutencao" | "planejamento";

type Manut = {
  id: string;
  descricao: string;
  status: "aberto" | "em_andamento" | "resolvido";
  created_at: string;
  resolvido_em: string | null;
  maquinas: {
    nome: string;
    tipo: string;
    identificador: string | null;
    status: string;
  } | null;
};

type DashboardData = {
  periodo: {
    de: string;
    ate: string;
    label: string;
    diasTotais: number;
    diasDecorridos: number;
    diasRestantes: number;
  };
  hoje: number;
  total: number;
  mediaDia: number;
  meta: number;
  pctMeta: number;
  metaProxDia: number;
  serie: { data: string; faturamento: number }[];
  ranking: { id: string; nome: string; faturamento: number; lancamentos: number }[];
  maquinas: { operando: number; paradas: number; urgentes: number; total: number };
  manutencoesAbertas: Manut[];
};

type MaquinaItem = {
  id: string;
  nome: string;
  tipo: string;
  identificador: string | null;
  status: MachineStatus;
};

type PlanejamentoItem = {
  id: string;
  ano: number;
  mes: number;
  talhao: string;
  quantidade_prevista: number | null;
  data_inicio: string | null;
  data_limite: string;
  status: PlanningStatus;
  observacoes: string | null;
  projetos: { nome: string } | null;
  atividades: { nome: string; unidade: string } | null;
  equipes: { nome: string } | null;
};

type AlertasPlanejamento = {
  hoje: string;
  horizonte: string;
  atrasados: PlanejamentoItem[];
  noPrazo: PlanejamentoItem[];
  futuros: PlanejamentoItem[];
};

const STATUS_OPTS: { value: MachineStatus; label: string }[] = [
  { value: "operando", label: "Operando" },
  { value: "parada", label: "Parada" },
  { value: "manutencao_urgente", label: "Manutenção urgente" },
];

const ABAS: { value: Aba; label: string }[] = [
  { value: "faturamento", label: "Faturamento" },
  { value: "manutencao", label: "Manutenção" },
  { value: "planejamento", label: "Planejamento" },
];

function statusManut(status: Manut["status"]) {
  if (status === "aberto") return <Badge tone="danger">aberto</Badge>;
  if (status === "em_andamento") return <Badge tone="warning">em andamento</Badge>;
  return <Badge tone="neutral">resolvido</Badge>;
}

function statusPlanejamento(status: PlanningStatus) {
  if (status === "concluido") return <Badge tone="success">concluído</Badge>;
  if (status === "em_execucao") return <Badge tone="warning">em execução</Badge>;
  if (status === "cancelado") return <Badge tone="neutral">cancelado</Badge>;
  return <Badge tone="info">planejado</Badge>;
}

function PlanejamentoLista({
  titulo,
  items,
  prioridade,
}: {
  titulo: string;
  items: PlanejamentoItem[];
  prioridade: "alta" | "normal" | "baixa";
}) {
  const box =
    prioridade === "alta"
      ? "border-[var(--color-danger-500)] bg-red-50"
      : prioridade === "normal"
        ? "border-amber-300 bg-amber-50"
        : "border-[var(--color-ink-200)] bg-white";
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-[var(--color-ink-900)]">{titulo}</h3>
        <span className="text-sm font-bold text-[var(--color-ink-700)]">
          {items.length}
        </span>
      </div>
      <div className="mt-3 space-y-3">
        {items.map((p) => (
          <div key={p.id} className={`rounded-xl border-2 p-4 ${box}`}>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold text-[var(--color-ink-900)]">
                {p.projetos?.nome ?? "Projeto"} · Talhão {p.talhao}
              </p>
              {statusPlanejamento(p.status)}
            </div>
            <p className="mt-1 text-sm font-semibold text-[var(--color-ink-800)]">
              {p.atividades?.nome ?? "Atividade"} · prazo {ddmmyyyy(p.data_limite)}
            </p>
            <p className="text-xs font-semibold text-[var(--color-ink-600)]">
              {p.equipes?.nome ?? "Equipe não definida"}
              {p.quantidade_prevista != null && p.atividades
                ? ` · previsto ${num(p.quantidade_prevista)} ${p.atividades.unidade}`
                : ""}
            </p>
            {p.observacoes && (
              <p className="mt-2 text-sm text-[var(--color-ink-700)]">{p.observacoes}</p>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <p className="py-4 text-center text-sm font-semibold text-[var(--color-ink-600)]">
            Sem itens nesta faixa.
          </p>
        )}
      </div>
    </Card>
  );
}

export default function GestorDashboard() {
  const [aba, setAba] = useState<Aba>("faturamento");
  const [periodo, setPeriodo] = useState<PeriodoState>({ preset: "ciclo_atual" });
  const [data, setData] = useState<DashboardData | null>(null);
  const [maquinas, setMaquinas] = useState<MaquinaItem[]>([]);
  const [alertas, setAlertas] = useState<AlertasPlanejamento | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      const sp = new URLSearchParams();
      sp.set("preset", periodo.preset);
      if (periodo.preset === "custom" && periodo.de && periodo.ate) {
        sp.set("de", periodo.de);
        sp.set("ate", periodo.ate);
      }
      const [r, mr, ar] = await Promise.all([
        fetch(`/api/dashboard?${sp.toString()}`),
        fetch("/api/maquinas"),
        fetch("/api/planejamento/alertas"),
      ]);
      const j = (await r.json()) as DashboardData & { error?: string };
      const mj = (await mr.json()) as { items?: MaquinaItem[]; error?: string };
      const aj = (await ar.json()) as AlertasPlanejamento & { error?: string };
      if (!r.ok || j.error) throw new Error(j.error ?? r.statusText);
      if (!mr.ok || mj.error) throw new Error(mj.error ?? mr.statusText);
      if (!ar.ok || aj.error) throw new Error(aj.error ?? ar.statusText);
      if (!j.periodo) throw new Error("resposta inválida do dashboard");
      setData(j);
      setMaquinas(Array.isArray(mj.items) ? mj.items : []);
      setAlertas(aj);
    } catch (err) {
      setData(null);
      setMaquinas([]);
      setAlertas(null);
      setErro((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function alterarStatusMaquina(id: string, status: MachineStatus) {
    const r = await fetch(`/api/maquinas/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErro(`Erro ao alterar status da máquina: ${j.error ?? r.statusText}`);
      return;
    }
    await carregar();
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo.preset, periodo.de, periodo.ate]);

  if (!data) {
    return (
      <div className="space-y-6">
        <PeriodoFiltro value={periodo} onChange={setPeriodo} />
        <div className="text-sm font-semibold text-[var(--color-ink-600)]">
          {erro ? `Erro ao carregar dashboard: ${erro}` : "Carregando…"}
        </div>
      </div>
    );
  }

  const totalFrota = data.maquinas.total;
  const totalAlertas =
    (alertas?.atrasados.length ?? 0) + (alertas?.noPrazo.length ?? 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-[var(--color-ink-100)] p-1">
        {ABAS.map((a) => (
          <button
            key={a.value}
            onClick={() => setAba(a.value)}
            className={
              "h-11 rounded-lg text-sm font-bold transition " +
              (aba === a.value
                ? "bg-white text-[var(--color-gn-700)] shadow-sm"
                : "text-[var(--color-ink-700)]")
            }
          >
            {a.label}
          </button>
        ))}
      </div>

      {erro && (
        <Card className="p-3 text-sm font-bold text-[var(--color-danger-500)]">
          {erro}
        </Card>
      )}

      {aba === "faturamento" && (
        <div className="space-y-6">
          <PeriodoFiltro value={periodo} onChange={setPeriodo} loading={loading} />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Faturamento — hoje" value={brl(data.hoje)} tone="positive" />
            <StatCard label="Total no período" value={brl(data.total)} hint={data.periodo.label} />
            <StatCard
              label="Média diária"
              value={brl(data.mediaDia)}
              hint={`${data.periodo.diasDecorridos} dia${data.periodo.diasDecorridos === 1 ? "" : "s"} decorridos`}
            />
            <StatCard
              label="% da meta"
              value={data.meta > 0 ? `${data.pctMeta.toFixed(1)}%` : "—"}
              tone={data.pctMeta >= 100 ? "positive" : data.pctMeta >= 70 ? "neutral" : "warning"}
              hint={data.meta > 0 ? `Meta: ${brl(data.meta)}` : "sem meta"}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5 md:col-span-2">
              <div className="flex items-baseline justify-between">
                <h3 className="font-bold">Produção diária</h3>
                <span className="text-xs font-semibold text-[var(--color-ink-600)]">
                  {data.periodo.label}
                </span>
              </div>
              <LinhaChart serie={data.serie} />
            </Card>

            <Card className="p-5">
              <h3 className="font-bold">Meta do próximo dia</h3>
              <p className="mt-3 text-3xl font-bold text-[var(--color-gn-700)] tabular">
                {brl(data.metaProxDia)}
              </p>
              <p className="text-xs font-semibold text-[var(--color-ink-600)] mt-1">
                (meta - faturado) ÷ {data.periodo.diasRestantes} dia
                {data.periodo.diasRestantes === 1 ? "" : "s"} restantes.
              </p>
              <div className="mt-4 h-3 w-full rounded-full bg-[var(--color-ink-100)] overflow-hidden">
                <div
                  className="h-full bg-[var(--color-gn-500)] transition-all"
                  style={{ width: `${Math.min(data.pctMeta, 100)}%` }}
                />
              </div>
              <p className="text-xs font-semibold text-[var(--color-ink-600)] mt-2">
                {brl(data.total)} de {brl(data.meta)}
              </p>
            </Card>
          </div>

          <Card className="p-5">
            <h3 className="font-bold">Top equipes</h3>
            <ol className="mt-3 space-y-2">
              {data.ranking.slice(0, 5).map((e, i) => (
                <li key={e.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-semibold">
                    <span className="h-6 w-6 rounded-full bg-[var(--color-gn-100)] text-[var(--color-gn-700)] text-xs font-bold inline-flex items-center justify-center">
                      {i + 1}
                    </span>
                    {e.nome}
                  </span>
                  <span className="font-bold tabular">{brl(e.faturamento)}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      )}

      {aba === "manutencao" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <Card className="p-3">
              <p className="text-3xl font-bold text-[var(--color-forest-700)] tabular">
                {data.maquinas.operando}
              </p>
              <p className="text-xs font-bold text-[var(--color-forest-700)] uppercase">
                operando
              </p>
            </Card>
            <Card className="p-3">
              <p className="text-3xl font-bold text-amber-700 tabular">
                {data.maquinas.paradas}
              </p>
              <p className="text-xs font-bold text-amber-700 uppercase">paradas</p>
            </Card>
            <Card className="p-3">
              <p className="text-3xl font-bold text-[var(--color-danger-500)] tabular">
                {data.maquinas.urgentes}
              </p>
              <p className="text-xs font-bold text-[var(--color-danger-500)] uppercase">
                urgentes
              </p>
            </Card>
          </div>

          <Card className="p-5">
            <h3 className="font-bold">Frota ativa ({totalFrota})</h3>
            <div className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
              {maquinas.map((m) => (
                <div key={m.id} className="rounded-xl border border-[var(--color-ink-200)] bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-[var(--color-ink-900)]">{m.nome}</p>
                      <p className="text-xs font-semibold text-[var(--color-ink-600)]">
                        {m.tipo}
                        {m.identificador ? ` · ${m.identificador}` : ""}
                      </p>
                    </div>
                    <select
                      value={m.status}
                      onChange={(e) =>
                        alterarStatusMaquina(m.id, e.target.value as MachineStatus)
                      }
                      className="h-10 min-w-36 rounded-lg border-2 border-[var(--color-ink-300)] bg-white px-2 text-xs font-bold text-[var(--color-ink-900)] shadow-sm"
                    >
                      {STATUS_OPTS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-baseline justify-between">
              <h3 className="font-bold">Manutenções abertas</h3>
              <span className="text-xs font-bold text-[var(--color-ink-600)]">
                {data.manutencoesAbertas.length} pendentes
              </span>
            </div>

            {data.manutencoesAbertas.length === 0 ? (
              <p className="mt-4 text-sm font-semibold text-[var(--color-ink-600)]">
                Frota toda em ordem.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {data.manutencoesAbertas.map((m) => (
                  <li key={m.id} className="border border-[var(--color-ink-200)] rounded-xl p-4 bg-[var(--color-ink-50)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-[var(--color-ink-900)]">
                          {m.maquinas?.nome ?? "Máquina removida"}
                          {m.maquinas?.identificador ? ` · ${m.maquinas.identificador}` : ""}
                        </p>
                        {m.maquinas?.tipo && (
                          <p className="text-xs font-semibold text-[var(--color-ink-600)]">
                            {m.maquinas.tipo}
                          </p>
                        )}
                      </div>
                      {statusManut(m.status)}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[var(--color-ink-800)]">
                      {m.descricao}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-[var(--color-ink-600)]">
                      Aberto em {ddmmyyyy(m.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {aba === "planejamento" && (
        <div className="space-y-4">
          <Card className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold">Alertas do planejamento</h3>
              <p className="text-sm font-semibold text-[var(--color-ink-600)]">
                {totalAlertas} item{totalAlertas === 1 ? "" : "s"} pedindo atenção.
              </p>
            </div>
            <Button onClick={carregar} loading={loading}>
              Gerar alertas
            </Button>
          </Card>

          <PlanejamentoLista
            titulo="Prioridade alta: passou do prazo"
            items={alertas?.atrasados ?? []}
            prioridade="alta"
          />
          <PlanejamentoLista
            titulo="No prazo: executar nos próximos 3 dias"
            items={alertas?.noPrazo ?? []}
            prioridade="normal"
          />
          <PlanejamentoLista
            titulo="Próximas atividades"
            items={alertas?.futuros ?? []}
            prioridade="baixa"
          />
        </div>
      )}
    </div>
  );
}
