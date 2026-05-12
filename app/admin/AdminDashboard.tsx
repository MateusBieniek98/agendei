"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, StatCard } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import AlertasCriticos, { type Alerta } from "@/components/dashboard/AlertasCriticos";
import { brl, ddmmyyyy } from "@/lib/format";
import { LinhaChart } from "@/app/gestor/GestorCharts";
import PeriodoFiltro, { type PeriodoState } from "@/components/dashboard/PeriodoFiltro";

type Manut = {
  id: string;
  descricao: string;
  status: "aberto" | "em_andamento" | "resolvido";
  created_at: string;
  resolvido_em: string | null;
  maquinas: { nome: string; tipo: string; identificador: string | null; status: string } | null;
};

type DashboardData = {
  periodo: {
    de: string; ate: string; label: string;
    diasTotais: number; diasDecorridos: number; diasRestantes: number;
  };
  hoje: number;
  total: number;
  mediaDia: number;
  meta: number;
  pctMeta: number;
  metaProxDia: number;
  serie: { data: string; faturamento: number }[];
  porAtividade: { id: string; nome: string; unidade: string; total: number; faturamento: number }[];
  ranking: { id: string; nome: string; faturamento: number; lancamentos: number }[];
  maquinas: { operando: number; paradas: number; urgentes: number; total: number };
  manutencoesAbertas: Manut[];
};

function buildAlertas(data: DashboardData): Alerta[] {
  const alertas: Alerta[] = [];
  if (data.maquinas.urgentes > 0) {
    alertas.push({
      id: "maq-urgentes",
      tipo: "danger",
      titulo: `${data.maquinas.urgentes} máquina${data.maquinas.urgentes > 1 ? "s" : ""} com manutenção urgente`,
      descricao: "Requer atenção imediata para não paralisar a operação.",
      href: "/admin/maquinas",
    });
  }
  if (data.maquinas.paradas > 0 && data.maquinas.urgentes === 0) {
    alertas.push({
      id: "maq-paradas",
      tipo: "warn",
      titulo: `${data.maquinas.paradas} máquina${data.maquinas.paradas > 1 ? "s" : ""} parada${data.maquinas.paradas > 1 ? "s" : ""}`,
      href: "/admin/maquinas",
    });
  }
  if (data.hoje === 0 && data.periodo.diasDecorridos > 0) {
    alertas.push({
      id: "sem-lancamento",
      tipo: "warn",
      titulo: "Nenhum lançamento registrado hoje",
      descricao: "Verifique se os encarregados estão conseguindo acessar o app.",
      href: "/admin/lancamentos",
    });
  }
  if (data.meta > 0 && data.pctMeta < 60 && data.periodo.diasDecorridos > 3) {
    alertas.push({
      id: "meta-baixa",
      tipo: "warn",
      titulo: `Meta ${data.pctMeta.toFixed(0)}% atingida — ritmo abaixo do esperado`,
      descricao: `Necessário ${brl(data.metaProxDia)}/dia nos ${data.periodo.diasRestantes} dias restantes.`,
      href: "/admin/metas",
    });
  }
  return alertas;
}

export default function AdminDashboard() {
  const [periodo, setPeriodo] = useState<PeriodoState>({ preset: "ciclo_atual" });
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [detalheAtividade, setDetalheAtividade] = useState(false);

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

  const expSearch = (() => {
    const sp = new URLSearchParams();
    if (data) { sp.set("data_de", data.periodo.de); sp.set("data_ate", data.periodo.ate); }
    return sp.toString();
  })();

  const alertas = data ? buildAlertas(data) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Dashboard</h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Visão consolidada da operação · {ddmmyyyy(new Date())}
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
          <Link
            href={`/api/export/xlsx?${expSearch}`}
            className="rounded-xl px-4 py-2 text-center text-sm font-bold transition hover:opacity-80"
            style={{ border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)" }}
          >
            ↓ Excel
          </Link>
          <Link
            href={`/api/export/csv?${expSearch}`}
            className="rounded-xl px-4 py-2 text-center text-sm font-bold transition hover:opacity-80"
            style={{ border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)" }}
          >
            ↓ CSV
          </Link>
        </div>
      </div>

      <PeriodoFiltro value={periodo} onChange={setPeriodo} loading={loading} />

      {!data ? (
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {erro ? `Erro: ${erro}` : "Carregando…"}
        </p>
      ) : (
        <>
          {/* Alertas críticos */}
          {alertas.length > 0 && <AlertasCriticos alertas={alertas} />}

          {/* KPIs — cards interativos */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Faturamento hoje"
              value={brl(data.hoje)}
              tone="positive"
              icon="💰"
            />
            <KpiCard
              label="Total no período"
              value={brl(data.total)}
              hint={data.periodo.label}
              icon="📊"
            />
            <KpiCard
              label="Média diária"
              value={brl(data.mediaDia)}
              hint={`${data.periodo.diasDecorridos} dias decorridos`}
              icon="📈"
            />
            <KpiCard
              label="% meta atingida"
              value={data.meta > 0 ? `${data.pctMeta.toFixed(1)}%` : "—"}
              tone={data.pctMeta >= 100 ? "positive" : data.pctMeta >= 70 ? "neutral" : "warning"}
              hint={data.meta > 0 ? `Meta: ${brl(data.meta)}` : "sem meta"}
              icon="🎯"
              href="/admin/metas"
            />
          </div>

          {/* Gráfico + atividades */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              className="p-5 rounded-2xl md:col-span-2"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-baseline justify-between">
                <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  Produção diária
                </h3>
                <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                  {data.periodo.label}
                </span>
              </div>
              <LinhaChart serie={data.serie} mediaDia={data.mediaDia} />
            </div>

            <div
              className="p-5 rounded-2xl"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-baseline justify-between">
                <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  Por atividade
                </h3>
                <button
                  onClick={() => setDetalheAtividade((v) => !v)}
                  className="text-xs font-semibold transition"
                  style={{ color: "var(--accent)" }}
                >
                  {detalheAtividade ? "resumir" : "detalhes"}
                </button>
              </div>
              <ul className="mt-3 space-y-2 max-h-72 overflow-auto pr-1">
                {data.porAtividade.map((a) => (
                  <li key={a.id}>
                    <div className="flex justify-between text-sm gap-2">
                      <span className="font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                        {a.nome}
                      </span>
                      <span className="shrink-0 font-bold tabular" style={{ color: "var(--text-secondary)" }}>
                        {brl(a.faturamento)}
                      </span>
                    </div>
                    {detalheAtividade && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {Number(a.total).toFixed(2)} {a.unidade}
                      </p>
                    )}
                    {/* Mini barra de progresso */}
                    <div
                      className="mt-1 h-1 rounded-full overflow-hidden"
                      style={{ background: "var(--bg-active)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, (a.faturamento / (data.porAtividade[0]?.faturamento || 1)) * 100)}%`,
                          background: "var(--accent)",
                        }}
                      />
                    </div>
                  </li>
                ))}
                {data.porAtividade.length === 0 && (
                  <li className="text-sm" style={{ color: "var(--text-muted)" }}>Sem dados.</li>
                )}
              </ul>
            </div>
          </div>

          {/* Meta projeção + ranking */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Termômetro de meta */}
            <div
              className="p-5 rounded-2xl"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                Projeção da meta
              </h3>
              <div className="mt-3 flex items-end gap-2">
                <p className="kpi-value" style={{ color: "var(--accent)" }}>
                  {brl(data.metaProxDia)}
                </p>
                <span className="text-sm mb-1 font-semibold" style={{ color: "var(--text-secondary)" }}>/dia</span>
              </div>
              <p className="mt-1 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                Necessário nos {data.periodo.diasRestantes} dia{data.periodo.diasRestantes !== 1 ? "s" : ""} restante{data.periodo.diasRestantes !== 1 ? "s" : ""} para bater a meta.
              </p>

              {/* Termômetro */}
              <div className="mt-4 meta-bar-track">
                <div
                  className="meta-bar-fill"
                  style={{
                    width: `${Math.min(data.pctMeta, 100)}%`,
                    background:
                      data.pctMeta >= 100 ? "var(--success)"
                      : data.pctMeta >= 70  ? "var(--accent)"
                      : "var(--warn)",
                  }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                <span>{brl(data.total)}</span>
                <span className="font-bold">{data.pctMeta.toFixed(1)}%</span>
                <span>{brl(data.meta)}</span>
              </div>

              {/* Status da frota */}
              {data.maquinas.total > 0 && (
                <Link href="/admin/maquinas" className="mt-4 flex items-center gap-3 p-3 rounded-xl transition"
                      style={{ background: "var(--bg-card-alt)", border: "1px solid var(--border)" }}>
                  <StatusDot count={data.maquinas.operando} color="var(--success)" label="Operando" />
                  <StatusDot count={data.maquinas.paradas} color="var(--danger)" label="Paradas" />
                  {data.maquinas.urgentes > 0 && (
                    <StatusDot count={data.maquinas.urgentes} color="var(--warn)" label="Urgente" />
                  )}
                  <span className="ml-auto text-xs font-semibold" style={{ color: "var(--accent)" }}>
                    frota →
                  </span>
                </Link>
              )}
            </div>

            {/* Ranking de equipes */}
            <div
              className="p-5 rounded-2xl"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                Ranking de equipes
              </h3>
              <ol className="mt-3 space-y-2">
                {data.ranking.map((e, i) => {
                  const pct = data.ranking[0]
                    ? (e.faturamento / data.ranking[0].faturamento) * 100
                    : 0;
                  return (
                    <li key={e.id}>
                      <div className="flex items-center justify-between text-sm gap-2">
                        <span className="flex items-center gap-2">
                          <span
                            className="h-6 w-6 rounded-full text-xs font-bold inline-flex items-center justify-center shrink-0"
                            style={{
                              background: i === 0 ? "var(--accent)" : "var(--bg-active)",
                              color: i === 0 ? "#fff" : "var(--text-secondary)",
                            }}
                          >
                            {i + 1}
                          </span>
                          <span className="font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                            {e.nome}
                          </span>
                        </span>
                        <span className="font-bold tabular shrink-0" style={{ color: "var(--text-primary)" }}>
                          {brl(e.faturamento)}
                        </span>
                      </div>
                      <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-active)" }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: i === 0 ? "var(--accent)" : "var(--text-muted)" }}
                        />
                      </div>
                    </li>
                  );
                })}
                {data.ranking.length === 0 && (
                  <li className="text-sm" style={{ color: "var(--text-muted)" }}>Sem dados.</li>
                )}
              </ol>
            </div>
          </div>

          {/* Manutenções abertas */}
          <div
            className="p-5 rounded-2xl"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                Manutenções abertas
              </h3>
              <Link
                href="/admin/maquinas"
                className="text-xs font-bold hover:underline"
                style={{ color: "var(--accent)" }}
              >
                gerenciar
              </Link>
            </div>

            {data.manutencoesAbertas.length === 0 ? (
              <p className="mt-4 text-sm font-semibold" style={{ color: "var(--success)" }}>
                ✅ Frota toda em ordem.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {data.manutencoesAbertas.map((m) => (
                  <li
                    key={m.id}
                    className="rounded-xl p-4"
                    style={{ background: "var(--bg-card-alt)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                          {m.maquinas?.nome ?? "Máquina removida"}
                          {m.maquinas?.identificador && (
                            <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                              {" "}· {m.maquinas.identificador}
                            </span>
                          )}
                        </p>
                        {m.maquinas?.tipo && (
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{m.maquinas.tipo}</p>
                        )}
                      </div>
                      <Badge
                        tone={m.status === "aberto" ? "danger" : m.status === "em_andamento" ? "warning" : "neutral"}
                      >
                        {(m.status ?? "sem_status").replaceAll("_", " ")}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                      {m.descricao}
                    </p>
                    <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                      Aberto em {ddmmyyyy(m.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Componentes internos ── */

function KpiCard({
  label, value, hint, tone, icon, href,
}: {
  label: string; value: string; hint?: string;
  tone?: "positive" | "neutral" | "warning"; icon?: string; href?: string;
}) {
  const accentColor =
    tone === "positive" ? "var(--success)"
    : tone === "warning" ? "var(--warn)"
    : "var(--text-primary)";

  const inner = (
    <div
      className="rounded-2xl p-5 flex flex-col gap-1 transition hover:shadow-md"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          {label}
        </span>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <p className="kpi-value" style={{ color: accentColor }}>{value}</p>
      {hint && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{hint}</p>}
      {href && (
        <p className="text-xs font-semibold mt-1" style={{ color: "var(--accent)" }}>
          ver detalhes →
        </p>
      )}
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}

function StatusDot({ count, color, label }: { count: number; color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
      <span style={{ color }}>{count}</span>
      <span>{label}</span>
    </div>
  );
}
