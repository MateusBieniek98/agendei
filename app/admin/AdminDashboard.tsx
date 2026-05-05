"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, StatCard } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { brl, ddmmyyyy } from "@/lib/format";
import { LinhaChart } from "@/app/gestor/GestorCharts";
import PeriodoFiltro, {
  type PeriodoState,
} from "@/components/dashboard/PeriodoFiltro";

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

export default function AdminDashboard() {
  const [periodo, setPeriodo] = useState<PeriodoState>({ preset: "ciclo_atual" });
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  async function carregar() {
    setLoading(true);
    const sp = new URLSearchParams();
    sp.set("preset", periodo.preset);
    if (periodo.preset === "custom" && periodo.de && periodo.ate) {
      sp.set("de", periodo.de);
      sp.set("ate", periodo.ate);
    }
    const r = await fetch(`/api/dashboard?${sp.toString()}`);
    const j = (await r.json()) as DashboardData;
    setData(j);
    setLoading(false);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo.preset, periodo.de, periodo.ate]);

  // URL com período pra exportações
  const expSearch = (() => {
    const sp = new URLSearchParams();
    if (data) {
      sp.set("data_de", data.periodo.de);
      sp.set("data_ate", data.periodo.ate);
    }
    return sp.toString();
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-[var(--color-ink-500)]">
            Visão consolidada da operação. Hoje · {ddmmyyyy(new Date())}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/api/export/xlsx?${expSearch}`}
            className="px-4 py-2 rounded-lg bg-white border border-[var(--color-ink-300)] text-sm font-medium hover:bg-[var(--color-ink-50)]"
          >
            Exportar XLSX
          </Link>
          <Link
            href={`/api/export/csv?${expSearch}`}
            className="px-4 py-2 rounded-lg bg-white border border-[var(--color-ink-300)] text-sm font-medium hover:bg-[var(--color-ink-50)]"
          >
            Exportar CSV
          </Link>
        </div>
      </div>

      <PeriodoFiltro value={periodo} onChange={setPeriodo} loading={loading} />

      {!data ? (
        <p className="text-sm text-[var(--color-ink-500)]">Carregando…</p>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Faturamento hoje"
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
              label="% meta atingida"
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

          {/* Gráfico + atividades */}
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
              <h3 className="font-semibold">Produção por atividade</h3>
              <ul className="mt-3 space-y-2 max-h-72 overflow-auto pr-1">
                {data.porAtividade.map((a) => (
                  <li
                    key={a.id}
                    className="text-sm flex justify-between gap-3"
                  >
                    <span className="truncate">{a.nome}</span>
                    <span className="text-[var(--color-ink-500)] tabular shrink-0">
                      {Number(a.total).toFixed(2)} {a.unidade} · {brl(a.faturamento)}
                    </span>
                  </li>
                ))}
                {data.porAtividade.length === 0 && (
                  <li className="text-sm text-[var(--color-ink-500)]">
                    Sem dados.
                  </li>
                )}
              </ul>
            </Card>
          </div>

          {/* Meta projeção + ranking */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="font-semibold">Projeção da meta</h3>
              <p className="mt-3 text-3xl font-bold text-[var(--color-gn-700)] tabular">
                {brl(data.metaProxDia)}/dia
              </p>
              <p className="text-xs text-[var(--color-ink-500)] mt-1">
                Necessário pelos {data.periodo.diasRestantes} dia
                {data.periodo.diasRestantes === 1 ? "" : "s"} restante
                {data.periodo.diasRestantes === 1 ? "" : "s"} pra bater a meta.
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

            <Card className="p-5">
              <h3 className="font-semibold">Ranking de equipes</h3>
              <ol className="mt-3 space-y-2">
                {data.ranking.map((e, i) => (
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
                    Sem dados.
                  </li>
                )}
              </ol>
            </Card>
          </div>

          {/* Manutenções abertas com descrição */}
          <Card className="p-5">
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold">Manutenções abertas</h3>
              <Link
                href="/admin/maquinas"
                className="text-xs text-[var(--color-gn-700)] hover:underline"
              >
                gerenciar →
              </Link>
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
                        {m.status.replace("_", " ")}
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
        </>
      )}
    </div>
  );
}
