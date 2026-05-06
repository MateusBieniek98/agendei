"use client";

import { useEffect, useState } from "react";
import { Card, StatCard } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { brl, ddmmyyyy } from "@/lib/format";
import { LinhaChart } from "./GestorCharts";
import PeriodoFiltro, { type PeriodoState } from "@/components/dashboard/PeriodoFiltro";
import type { MachineStatus } from "@/lib/types";

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
  porAtividade: {
    id: string;
    nome: string;
    unidade: string;
    total: number;
    faturamento: number;
  }[];
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

const STATUS_OPTS: { value: MachineStatus; label: string }[] = [
  { value: "operando", label: "Operando" },
  { value: "parada", label: "Parada" },
  { value: "manutencao_urgente", label: "Manutenção urgente" },
];

export default function GestorDashboard() {
  const [periodo, setPeriodo] = useState<PeriodoState>({ preset: "ciclo_atual" });
  const [data, setData] = useState<DashboardData | null>(null);
  const [maquinas, setMaquinas] = useState<MaquinaItem[]>([]);
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
      const [r, mr] = await Promise.all([
        fetch(`/api/dashboard?${sp.toString()}`),
        fetch("/api/maquinas"),
      ]);
      const j = (await r.json()) as DashboardData & { error?: string };
      const mj = (await mr.json()) as { items?: MaquinaItem[]; error?: string };
      if (!r.ok || j.error) throw new Error(j.error ?? r.statusText);
      if (!mr.ok || mj.error) throw new Error(mj.error ?? mr.statusText);
      if (!j.periodo) throw new Error("resposta inválida do dashboard");
      setData(j);
      setMaquinas(Array.isArray(mj.items) ? mj.items : []);
    } catch (err) {
      setData(null);
      setMaquinas([]);
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
        <div className="text-sm text-[var(--color-ink-500)]">
          {erro ? `Erro ao carregar dashboard: ${erro}` : "Carregando…"}
        </div>
      </div>
    );
  }

  const totalFrota = data.maquinas.total;

  return (
    <div className="space-y-6">
      <PeriodoFiltro value={periodo} onChange={setPeriodo} loading={loading} />

      {/* KPIs principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Faturamento — hoje"
          value={brl(data.hoje)}
          tone="positive"
        />
        <StatCard
          label="Total no período"
          value={brl(data.total)}
          hint={data.periodo.label}
        />
        <StatCard
          label="Média diária"
          value={brl(data.mediaDia)}
          hint={`${data.periodo.diasDecorridos} dia${data.periodo.diasDecorridos === 1 ? "" : "s"} decorrido${data.periodo.diasDecorridos === 1 ? "" : "s"}`}
        />
        <StatCard
          label="% da meta"
          value={data.meta > 0 ? `${data.pctMeta.toFixed(1)}%` : "—"}
          tone={
            data.pctMeta >= 100
              ? "positive"
              : data.pctMeta >= 70
                ? "neutral"
                : "warning"
          }
          hint={data.meta > 0 ? `Meta: ${brl(data.meta)}` : "sem meta"}
        />
      </div>

      {/* Gráfico + meta projeção */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 md:col-span-2">
          <div className="flex items-baseline justify-between">
            <h3 className="font-semibold">Produção diária</h3>
            <span className="text-xs text-[var(--color-ink-500)]">
              {data.periodo.label}
            </span>
          </div>
          <LinhaChart serie={data.serie} />
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold">Meta do próximo dia</h3>
          <p className="mt-3 text-3xl font-bold text-[var(--color-gn-700)] tabular">
            {brl(data.metaProxDia)}
          </p>
          <p className="text-xs text-[var(--color-ink-500)] mt-1">
            (meta − faturado) ÷ {data.periodo.diasRestantes} dia
            {data.periodo.diasRestantes === 1 ? "" : "s"} restante
            {data.periodo.diasRestantes === 1 ? "" : "s"}.
          </p>
          <div className="mt-4 h-3 w-full rounded-full bg-[var(--color-ink-100)] overflow-hidden">
            <div
              className="h-full bg-[var(--color-gn-500)] transition-all"
              style={{ width: `${Math.min(data.pctMeta, 100)}%` }}
            />
          </div>
          <p className="text-xs text-[var(--color-ink-500)] mt-2">
            {brl(data.total)} de {brl(data.meta)}
          </p>
        </Card>
      </div>

      {/* Frota + Top equipes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-semibold">Frota</h3>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-[var(--color-forest-100)] p-3">
              <p className="text-3xl font-bold text-[var(--color-forest-700)] tabular">
                {data.maquinas.operando}
              </p>
              <p className="text-xs mt-1 text-[var(--color-forest-700)] uppercase tracking-wide">
                operando
              </p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3">
              <p className="text-3xl font-bold text-amber-700 tabular">
                {data.maquinas.paradas}
              </p>
              <p className="text-xs mt-1 text-amber-700 uppercase tracking-wide">
                paradas
              </p>
            </div>
            <div className="rounded-xl bg-red-50 p-3">
              <p className="text-3xl font-bold text-[var(--color-danger-500)] tabular">
                {data.maquinas.urgentes}
              </p>
              <p className="text-xs mt-1 text-[var(--color-danger-500)] uppercase tracking-wide">
                urgentes
              </p>
            </div>
          </div>
          <p className="text-xs text-[var(--color-ink-500)] mt-3">
            Total ativo: {totalFrota} máquinas.
          </p>
          <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
            {maquinas.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-[var(--color-ink-100)] bg-white p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[var(--color-ink-900)]">
                      {m.nome}
                    </p>
                    <p className="text-xs font-semibold text-[var(--color-ink-500)]">
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
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold">Top equipes</h3>
          <ol className="mt-3 space-y-2">
            {data.ranking.slice(0, 5).map((e, i) => (
              <li
                key={e.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-[var(--color-gn-100)] text-[var(--color-gn-700)] text-xs font-bold inline-flex items-center justify-center">
                    {i + 1}
                  </span>
                  {e.nome}
                </span>
                <span className="font-semibold tabular">
                  {brl(e.faturamento)}
                </span>
              </li>
            ))}
            {data.ranking.length === 0 && (
              <li className="text-sm text-[var(--color-ink-500)]">
                Sem dados ainda.
              </li>
            )}
          </ol>
        </Card>
      </div>

      {/* NOVO: Manutenções abertas com descrição */}
      <Card className="p-5">
        <div className="flex items-baseline justify-between">
          <h3 className="font-semibold">Manutenções abertas</h3>
          <span className="text-xs text-[var(--color-ink-500)]">
            {data.manutencoesAbertas.length} pendente
            {data.manutencoesAbertas.length === 1 ? "" : "s"}
          </span>
        </div>

        {data.manutencoesAbertas.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--color-ink-500)]">
            Frota toda em ordem 🌲
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {data.manutencoesAbertas.map((m) => (
              <li
                key={m.id}
                className="border border-[var(--color-ink-100)] rounded-xl p-4 bg-[var(--color-ink-50)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[var(--color-ink-900)]">
                      {m.maquinas?.nome ?? "Máquina removida"}
                      {m.maquinas?.identificador && (
                        <span className="text-[var(--color-ink-500)] font-normal">
                          {" "}
                          · {m.maquinas.identificador}
                        </span>
                      )}
                    </p>
                    {m.maquinas?.tipo && (
                      <p className="text-xs text-[var(--color-ink-500)]">
                        {m.maquinas.tipo}
                      </p>
                    )}
                  </div>
                  <Badge
                    tone={
                      m.status === "aberto"
                        ? "danger"
                        : m.status === "em_andamento"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {(m.status ?? "sem_status").replaceAll("_", " ")}
                  </Badge>
                </div>

                <p className="mt-2 text-sm text-[var(--color-ink-700)] italic">
                  “{m.descricao}”
                </p>

                <p className="mt-2 text-xs text-[var(--color-ink-500)]">
                  Aberto em {ddmmyyyy(m.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
