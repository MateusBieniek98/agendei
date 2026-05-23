"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BottomNav, { type DashboardDockTab } from "@/components/nav/BottomNav";
import { brl, ddmmyyyy } from "@/lib/format";
import { LinhaChart } from "@/app/gestor/GestorCharts";
import PeriodoFiltro, { type PeriodoState } from "@/components/dashboard/PeriodoFiltro";
import PlanejamentoField from "@/app/(field)/planejamento/PlanejamentoField";

type DashboardMode = "admin" | "gestor" | "encarregado";

type DashboardLinks = {
  maquinas: string;
  lancamentos: string;
  metas: string;
};

const DASHBOARD_LINKS: Record<DashboardMode, DashboardLinks> = {
  admin: {
    maquinas: "/admin/maquinas",
    lancamentos: "/admin/lancamentos",
    metas: "/admin/metas",
  },
  gestor: {
    maquinas: "/gestor",
    lancamentos: "/gestor",
    metas: "/gestor",
  },
  encarregado: {
    maquinas: "/maquinas",
    lancamentos: "/resumo",
    metas: "/resumo",
  },
};

type AdminDashboardProps = {
  mode?: DashboardMode;
  showExports?: boolean;
  initialTab?: DashboardDockTab;
};

type Manut = {
  id: string;
  descricao: string;
  status: "aberto" | "em_andamento" | "resolvido";
  created_at: string;
  resolvido_em: string | null;
  talhao: string | null;
  maquinas: { nome: string; tipo: string; identificador: string | null; status: string } | null;
  equipes: { nome: string } | null;
  projetos: { nome: string } | null;
};

type DashboardData = {
  periodo: {
    de: string;
    ate: string;
    label: string;
    diasTotais: number;
    diasDecorridos: number;
    diasRestantes: number;
    diasRestantesAposHoje: number;
  };
  hoje: number;
  ontem: number;
  total: number;
  mediaDia: number;
  meta: number;
  pctMeta: number;
  metaProxDia: number;
  serie: { data: string; faturamento: number }[];
  porAtividade: { id: string; nome: string; unidade: string; total: number; faturamento: number }[];
  ranking: {
    id: string;
    nome: string;
    faturamento: number;
    lancamentos: number;
    metaEquipe: number;
    projecao: number;
    pctMeta: number;
    pctProjecao: number;
    statusMeta: "dentro" | "abaixo" | "sem_meta";
  }[];
  metaEquipes: { totalMeta: number; diferenca: number };
  maquinas: { operando: number; paradas: number; urgentes: number; total: number };
  manutencoesAbertas: Manut[];
};

function compactBrl(value: number | null | undefined) {
  const n = Number(value ?? 0);
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}mi`;
  if (abs >= 1_000) return `R$ ${(n / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}k`;
  return brl(n);
}

function progressColor(row: DashboardData["ranking"][number]) {
  if (row.metaEquipe <= 0) return "var(--text-muted)";
  if (row.pctProjecao >= 100) return "var(--success)";
  if (row.pctProjecao >= 75) return "var(--warn)";
  return "var(--danger)";
}

function statusLabel(status: Manut["status"]) {
  if (status === "em_andamento") return "em andamento";
  if (status === "resolvido") return "resolvido";
  return "aberto";
}

export default function AdminDashboard({
  mode = "admin",
  showExports,
  initialTab = "indicadores",
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardDockTab>(initialTab);
  const [periodo, setPeriodo] = useState<PeriodoState>({ preset: "ciclo_atual" });
  const [data, setData] = useState<DashboardData | null>(null);
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
      const r = await fetch(`/api/dashboard?${sp.toString()}`);
      const j = (await r.json()) as DashboardData & { error?: string };
      if (!r.ok || j.error) throw new Error(j.error ?? r.statusText);
      if (!j.periodo) throw new Error("resposta inválida do dashboard");
      setData(j);
    } catch (err) {
      setData(null);
      setErro((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo.preset, periodo.de, periodo.ate]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const expSearch = useMemo(() => {
    const sp = new URLSearchParams();
    if (data) {
      sp.set("data_de", data.periodo.de);
      sp.set("data_ate", data.periodo.ate);
    }
    return sp.toString();
  }, [data]);

  const links = DASHBOARD_LINKS[mode];
  const canManageMetas = mode === "admin";
  const showExportActions = showExports ?? mode === "admin";
  const showPeriodFilter = activeTab === "indicadores" || activeTab === "equipes";

  return (
    <div className="space-y-3 pb-2">
      {showPeriodFilter && (
        <PeriodoFiltro value={periodo} onChange={setPeriodo} loading={loading} />
      )}

      {activeTab === "planejamento" ? (
        <PlanejamentoField equipeId={null} />
      ) : !data ? (
        <div
          className="rounded-lg border p-4 text-sm font-semibold"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          {erro ? `Erro: ${erro}` : "Carregando dados..."}
        </div>
      ) : (
        <>
          {erro && (
            <div
              className="rounded-lg border p-3 text-sm font-bold"
              style={{ background: "var(--danger-bg)", borderColor: "var(--danger)", color: "var(--danger)" }}
            >
              {erro}
            </div>
          )}

          {activeTab === "indicadores" && (
            <IndicadoresPage
              data={data}
              canManageMetas={canManageMetas}
              links={links}
              showExportActions={showExportActions}
              expSearch={expSearch}
            />
          )}

          {activeTab === "equipes" && (
            <EquipesPage data={data} canManageMetas={canManageMetas} links={links} />
          )}

          {activeTab === "manutencao" && <ManutencaoPage data={data} links={links} />}
        </>
      )}

      <BottomNav viewType={mode === "admin" ? "admin" : "gestor"} activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

function IndicadoresPage({
  data,
  canManageMetas,
  links,
  showExportActions,
  expSearch,
}: {
  data: DashboardData;
  canManageMetas: boolean;
  links: DashboardLinks;
  showExportActions: boolean;
  expSearch: string;
}) {
  return (
    <section className="space-y-3">
      {showExportActions && (
        <div className="grid grid-cols-2 gap-2 sm:ml-auto sm:w-56">
          <Link
            href={`/api/export/xlsx?${expSearch}`}
            className="h-10 rounded-lg border px-3 text-center text-sm font-bold leading-10 transition hover:opacity-80"
            style={{ borderColor: "var(--border)", background: "var(--bg-card)", color: "var(--text-primary)" }}
          >
            Excel
          </Link>
          <Link
            href={`/api/export/csv?${expSearch}`}
            className="h-10 rounded-lg border px-3 text-center text-sm font-bold leading-10 transition hover:opacity-80"
            style={{ borderColor: "var(--border)", background: "var(--bg-card)", color: "var(--text-primary)" }}
          >
            CSV
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        <DailyRevenueCard hoje={data.hoje} ontem={data.ontem} />
        <KpiCard label="Total no período" value={brl(data.total)} hint={data.periodo.label} />
        <KpiCard label="Média diária" value={brl(data.mediaDia)} hint={`${data.periodo.diasDecorridos} dias`} />
        <KpiCard
          label="% meta atingida"
          value={data.meta > 0 ? `${data.pctMeta.toFixed(1)}%` : "-"}
          hint={data.meta > 0 ? `Meta ${compactBrl(data.meta)}` : "sem meta"}
          tone={data.pctMeta >= 100 ? "success" : data.pctMeta >= 70 ? "neutral" : "warn"}
          href={canManageMetas ? links.metas : undefined}
        />
      </div>

      <div
        className="rounded-lg border p-3 sm:p-4"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            Produção diária
          </h2>
          <span className="truncate text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            {data.periodo.label}
          </span>
        </div>
        <LinhaChart
          serie={data.serie}
          mediaDia={data.mediaDia}
          className="mt-2 h-[218px] max-h-[250px] w-full overflow-hidden"
        />
      </div>
    </section>
  );
}

function DailyRevenueCard({ hoje, ontem }: { hoje: number; ontem: number }) {
  return (
    <div
      className="rounded-lg border p-3 sm:p-4"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
    >
      <p className="text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>
        Faturamento diário
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="min-w-0 rounded-lg p-2" style={{ background: "var(--bg-card-alt)" }}>
          <p className="text-[11px] font-bold uppercase" style={{ color: "var(--text-muted)" }}>
            Hoje
          </p>
          <p className="mt-1 truncate text-xl font-black tabular sm:text-2xl" style={{ color: "var(--success)" }}>
            {brl(hoje)}
          </p>
        </div>
        <div className="min-w-0 rounded-lg p-2" style={{ background: "var(--bg-card-alt)" }}>
          <p className="text-[11px] font-bold uppercase" style={{ color: "var(--text-muted)" }}>
            Ontem
          </p>
          <p className="mt-1 truncate text-xl font-black tabular sm:text-2xl" style={{ color: "var(--accent)" }}>
            {brl(ontem)}
          </p>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  tone = "neutral",
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "success" | "neutral" | "warn";
  href?: string;
}) {
  const color =
    tone === "success" ? "var(--success)" : tone === "warn" ? "var(--warn)" : "var(--text-primary)";

  const inner = (
    <div
      className="h-full rounded-lg border p-3 transition hover:shadow-sm sm:p-4"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
    >
      <p className="text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="mt-1 truncate text-xl font-black tabular sm:text-2xl" style={{ color }}>
        {value}
      </p>
      {hint && (
        <p className="mt-1 truncate text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
          {hint}
        </p>
      )}
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}

function EquipesPage({
  data,
  canManageMetas,
  links,
}: {
  data: DashboardData;
  canManageMetas: boolean;
  links: DashboardLinks;
}) {
  const equipesComMeta = data.ranking.filter((e) => e.metaEquipe > 0);
  const equipesSemMeta = data.ranking.filter((e) => e.metaEquipe <= 0 && e.faturamento > 0);

  return (
    <section className="space-y-3">
      <div
        className="rounded-lg border p-4 text-center"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
      >
        <p className="text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>
          Projeção da meta
        </p>
        <p className="mt-1 text-2xl font-black tabular sm:text-3xl" style={{ color: "var(--accent)" }}>
          {brl(data.metaProxDia)}
          <span className="text-sm font-bold" style={{ color: "var(--text-secondary)" }}>
            /dia
          </span>
        </p>
        <p className="mt-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
          {data.periodo.diasRestantesAposHoje > 0
            ? `${data.periodo.diasRestantesAposHoje} dias após hoje para fechar o ciclo.`
            : "Ciclo sem dias restantes após hoje."}
        </p>
      </div>

      <div
        className="overflow-hidden rounded-lg border"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between gap-3 border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
          <div>
            <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              Equipes
            </h2>
            <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              Realizado, projeção e meta do período
            </p>
          </div>
          {canManageMetas && (
            <Link
              href={links.metas}
              className="h-9 rounded-lg px-3 text-xs font-bold leading-9 transition hover:opacity-80"
              style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
            >
              Metas
            </Link>
          )}
        </div>

        {equipesComMeta.length === 0 ? (
          <div className="p-4 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
            Nenhuma meta por equipe definida para este período.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed text-left text-xs sm:text-sm">
              <thead style={{ background: "var(--bg-card-alt)", color: "var(--text-muted)" }}>
                <tr>
                  <th className="w-[34%] px-3 py-2 font-bold">Equipe</th>
                  <th className="px-3 py-2 text-right font-bold">Real.</th>
                  <th className="px-3 py-2 text-right font-bold">Proj.</th>
                  <th className="px-3 py-2 text-right font-bold">Meta</th>
                  <th className="w-[22%] px-3 py-2 font-bold">Ritmo</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                {equipesComMeta.map((e) => {
                  const color = progressColor(e);
                  const progress = Math.min(Math.max(e.pctProjecao, e.pctMeta, 0), 100);
                  return (
                    <tr key={e.id} className="align-middle">
                      <td className="px-3 py-2">
                        <p className="truncate font-bold" style={{ color: "var(--text-primary)" }}>
                          {e.nome}
                        </p>
                        <p className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
                          {e.lancamentos} lanç.
                        </p>
                      </td>
                      <td className="px-3 py-2 text-right font-bold tabular" style={{ color: "var(--text-primary)" }}>
                        {compactBrl(e.faturamento)}
                      </td>
                      <td className="px-3 py-2 text-right font-bold tabular" style={{ color }}>
                        {compactBrl(e.projecao)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular" style={{ color: "var(--text-secondary)" }}>
                        {compactBrl(e.metaEquipe)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--bg-active)" }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${progress}%`, background: color }}
                          />
                        </div>
                        <p className="mt-1 text-right text-[11px] font-bold tabular" style={{ color }}>
                          {e.pctProjecao.toFixed(0)}%
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {equipesSemMeta.length > 0 && (
          <p className="border-t px-3 py-2 text-xs font-semibold" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
            {equipesSemMeta.length} equipe{equipesSemMeta.length > 1 ? "s" : ""} com produção no período ainda sem meta distribuída.
          </p>
        )}
      </div>
    </section>
  );
}

function ManutencaoPage({ data, links }: { data: DashboardData; links: DashboardLinks }) {
  return (
    <section className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <FleetMetric label="Operando" value={data.maquinas.operando} color="var(--success)" />
        <FleetMetric label="Paradas" value={data.maquinas.paradas} color="var(--warn)" />
        <FleetMetric label="Urgentes" value={data.maquinas.urgentes} color="var(--danger)" />
      </div>

      <div
        className="rounded-lg border p-3 sm:p-4"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              Manutenções abertas
            </h2>
            <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              {data.manutencoesAbertas.length} pendente{data.manutencoesAbertas.length === 1 ? "" : "s"}
            </p>
          </div>
          <Link
            href={links.maquinas}
            className="h-9 rounded-lg px-3 text-xs font-bold leading-9 transition hover:opacity-80"
            style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
          >
            Abrir frota
          </Link>
        </div>

        {data.manutencoesAbertas.length === 0 ? (
          <p className="mt-4 text-sm font-semibold" style={{ color: "var(--success)" }}>
            Frota toda em ordem.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.manutencoesAbertas.map((m) => (
              <li
                key={m.id}
                className="rounded-lg border p-3"
                style={{ background: "var(--bg-card-alt)", borderColor: "var(--border)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                      {m.maquinas?.nome ?? "Máquina removida"}
                      {m.maquinas?.identificador ? ` · ${m.maquinas.identificador}` : ""}
                    </p>
                    <p className="truncate text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                      {m.equipes?.nome ?? "Frente não informada"}
                      {m.projetos?.nome ? ` · ${m.projetos.nome}` : ""}
                      {m.talhao ? ` · Talhão ${m.talhao}` : ""}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2 py-1 text-[11px] font-bold"
                    style={{
                      background: m.status === "aberto" ? "var(--danger-bg)" : "var(--warn-bg)",
                      color: m.status === "aberto" ? "var(--danger)" : "var(--warn)",
                    }}
                  >
                    {statusLabel(m.status)}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                  {m.descricao}
                </p>
                <p className="mt-1 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                  Aberto em {ddmmyyyy(m.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function FleetMetric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="rounded-lg border p-3"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
    >
      <p className="text-xl font-black tabular sm:text-2xl" style={{ color }}>
        {value}
      </p>
      <p className="truncate text-[11px] font-bold uppercase" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
    </div>
  );
}
