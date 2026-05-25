import Link from "next/link";
import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { brl, ddmmyyyy, num } from "@/lib/format";
import { dataOperacionalISO, resolvePreset } from "@/lib/period";
import { enrichPlanningProgress } from "@/lib/planning-progress";
import MeuDiaSyncCard from "./MeuDiaSyncCard";
import type { MaintenanceStatus, PlanningStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type ProducaoDia = {
  id: string;
  data: string;
  quantidade: number | string;
  valor_unitario_snapshot: number | string;
  talhao: string | null;
  created_at: string;
  atividades: { nome: string; unidade: string } | null;
  projetos: { nome: string } | null;
};

type PlanejamentoDia = {
  id: string;
  projeto_id: string;
  atividade_id: string;
  talhao: string;
  quantidade_prevista: number | null;
  data_inicio: string | null;
  data_limite: string;
  status: PlanningStatus;
  observacoes: string | null;
  projetos: { nome: string } | null;
  atividades: { nome: string; unidade: string; valor_unitario: number } | null;
  equipes: { nome: string } | null;
  quantidade_realizada: number;
  pct_realizado: number;
  faturamento_planejado: number;
};

type ManutencaoDia = {
  id: string;
  descricao: string;
  status: MaintenanceStatus;
  created_at: string;
  talhao: string | null;
  maquinas: { nome: string; tipo: string; identificador: string | null; status: string } | null;
  projetos: { nome: string } | null;
};

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
      <path d="M4 13a8 8 0 1 1 16 0" />
      <path d="M12 13l4-4" />
      <path d="M7 21h10" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
      <path d="M14.7 6.3a4 4 0 0 0 4.9 4.9l-8.4 8.4a2.1 2.1 0 0 1-3-3l8.4-8.4Z" />
      <path d="m5 19 2-2" />
    </svg>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = "accent",
}: {
  label: string;
  value: string | number;
  hint: string;
  tone?: "accent" | "success" | "warn";
}) {
  const color = tone === "success" ? "var(--success)" : tone === "warn" ? "var(--warn)" : "var(--accent)";
  return (
    <div
      className="rounded-lg border p-3"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
    >
      <p className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="mt-1 text-xl font-black tabular sm:text-2xl" style={{ color }}>
        {value}
      </p>
      <p className="mt-1 truncate text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
        {hint}
      </p>
    </div>
  );
}

function ActionCard({
  href,
  title,
  subtitle,
  icon,
  primary = false,
}: {
  href: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border p-3 transition hover:opacity-90 active:scale-[0.99]"
      style={{
        background: primary ? "var(--accent)" : "var(--bg-card)",
        borderColor: primary ? "var(--accent)" : "var(--border)",
        color: primary ? "#fff" : "var(--text-primary)",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="grid h-9 w-9 place-items-center rounded-lg"
          style={{
            background: primary ? "rgba(255,255,255,0.16)" : "var(--accent-subtle)",
            color: primary ? "#fff" : "var(--accent)",
          }}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-black">{title}</p>
          <p className="truncate text-[11px] font-semibold opacity-75">{subtitle}</p>
        </div>
      </div>
    </Link>
  );
}

function PlanejamentoCard({ item }: { item: PlanejamentoDia }) {
  const params = new URLSearchParams();
  params.set("atividade_id", item.atividade_id);
  params.set("projeto_id", item.projeto_id);
  params.set("talhao", item.talhao);

  return (
    <li
      className="rounded-lg border p-3"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black uppercase" style={{ color: "var(--text-primary)" }}>
            {item.atividades?.nome ?? "Atividade"}
          </p>
          <p className="mt-0.5 truncate text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
            {item.projetos?.nome ?? "Projeto"} · Talhao {item.talhao}
          </p>
          <p className="mt-1 text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
            Prazo {ddmmyyyy(item.data_limite)}
          </p>
        </div>
        <Link
          href={`/lancamento?${params.toString()}`}
          className="grid h-9 shrink-0 place-items-center rounded-lg px-3 text-xs font-black"
          style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
        >
          Lançar
        </Link>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(Number(item.pct_realizado ?? 0), 100)}%`,
            background: Number(item.pct_realizado ?? 0) >= 100 ? "var(--success)" : "var(--accent)",
          }}
        />
      </div>
    </li>
  );
}

function ProducaoCard({ item }: { item: ProducaoDia }) {
  const quantidade = Number(item.quantidade ?? 0);
  const faturamento = quantidade * Number(item.valor_unitario_snapshot ?? 0);
  return (
    <li className="flex items-start justify-between gap-3 border-t py-2 first:border-t-0" style={{ borderColor: "var(--border)" }}>
      <div className="min-w-0">
        <p className="truncate text-sm font-black uppercase" style={{ color: "var(--text-primary)" }}>
          {item.atividades?.nome ?? "Atividade"}
        </p>
        <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
          {num(quantidade)} {item.atividades?.unidade ?? "ha"} · {item.talhao ? `Talhao ${item.talhao}` : "Sem talhao"}
        </p>
      </div>
      <p className="shrink-0 text-sm font-black tabular" style={{ color: "var(--accent)" }}>
        {brl(faturamento)}
      </p>
    </li>
  );
}

function ManutencaoCard({ item }: { item: ManutencaoDia }) {
  return (
    <li className="border-t py-2 first:border-t-0" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black" style={{ color: "var(--text-primary)" }}>
            {item.maquinas?.nome ?? "Maquina"}
          </p>
          <p className="truncate text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            {item.descricao}
          </p>
        </div>
        <span
          className="rounded-full px-2 py-1 text-[10px] font-black"
          style={{ background: "var(--warn-bg)", color: "var(--warn)" }}
        >
          {item.status === "em_andamento" ? "Em andamento" : "Aberta"}
        </span>
      </div>
    </li>
  );
}

export default async function MeuDiaPage() {
  const profile = await requireRole(["encarregado", "admin"]);
  const supabase = await createSupabaseServer();
  const hoje = dataOperacionalISO();
  const ciclo = resolvePreset("ciclo_atual");
  const equipeId = profile.equipe_id;

  let producaoQuery = supabase
    .from("producao")
    .select("id, data, quantidade, valor_unitario_snapshot, talhao, created_at, atividades(nome, unidade), projetos(nome)")
    .eq("data", hoje)
    .order("created_at", { ascending: false })
    .limit(50);

  let planejamentoQuery = supabase
    .from("planejamento")
    .select("*, projetos(nome), atividades(nome, unidade, valor_unitario), equipes(nome)")
    .neq("status", "cancelado")
    .or(`data_inicio.lte.${hoje},data_inicio.is.null`)
    .gte("data_limite", hoje)
    .order("data_limite", { ascending: true })
    .limit(120);

  let atrasadosQuery = supabase
    .from("planejamento")
    .select("id")
    .neq("status", "cancelado")
    .neq("status", "concluido")
    .lt("data_limite", hoje)
    .limit(200);

  let manutencoesQuery = supabase
    .from("manutencoes")
    .select("id, descricao, status, created_at, talhao, maquinas(nome, tipo, identificador, status), projetos(nome)")
    .neq("status", "resolvido")
    .order("created_at", { ascending: false })
    .limit(5);

  let metaEquipeQuery = supabase
    .from("metas_equipes")
    .select("valor_meta")
    .eq("ano", Number(ciclo.ate.slice(0, 4)))
    .eq("mes", Number(ciclo.ate.slice(5, 7)))
    .limit(1);

  if (equipeId) {
    producaoQuery = producaoQuery.eq("equipe_id", equipeId);
    planejamentoQuery = planejamentoQuery.eq("equipe_id", equipeId);
    atrasadosQuery = atrasadosQuery.eq("equipe_id", equipeId);
    manutencoesQuery = manutencoesQuery.eq("equipe_id", equipeId);
    metaEquipeQuery = metaEquipeQuery.eq("equipe_id", equipeId);
  }

  const [
    { data: producaoDiaRaw },
    { data: planejamentoRaw },
    { data: atrasadosRaw },
    { data: manutencoesRaw },
    { data: metaEquipeRaw },
  ] = await Promise.all([
    producaoQuery,
    planejamentoQuery,
    atrasadosQuery,
    manutencoesQuery,
    metaEquipeQuery,
  ]);

  const producaoDia = (producaoDiaRaw ?? []) as unknown as ProducaoDia[];
  const planejamentoDia = (await enrichPlanningProgress(
    supabase,
    planejamentoRaw ?? []
  )) as unknown as PlanejamentoDia[];
  const manutencoes = (manutencoesRaw ?? []) as unknown as ManutencaoDia[];
  const metaEquipe = Number(metaEquipeRaw?.[0]?.valor_meta ?? 0);
  const metaDia = metaEquipe > 0 ? metaEquipe / ciclo.diasTotais : 0;
  const faturamentoHoje = producaoDia.reduce(
    (sum, item) => sum + Number(item.quantidade ?? 0) * Number(item.valor_unitario_snapshot ?? 0),
    0
  );
  const pctMetaDia = metaDia > 0 ? (faturamentoHoje / metaDia) * 100 : 0;
  const firstName = profile.nome.split(" ")[0] || "equipe";

  return (
    <section className="mx-auto max-w-3xl space-y-3">
      <div
        className="rounded-lg border p-4"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
      >
        <p className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>
          Meu dia · {ddmmyyyy(hoje)}
        </p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-black" style={{ color: "var(--text-primary)" }}>
              Bom trabalho, {firstName}
            </h1>
            <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
              {ciclo.label}
            </p>
          </div>
          <Link
            href="/gestor?tab=indicadores"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg"
            style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
            aria-label="Abrir indicadores"
          >
            <DashboardIcon />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Hoje" value={brl(faturamentoHoje)} hint={`${producaoDia.length} lancamento(s)`} tone="success" />
        <StatCard label="Meta dia" value={metaDia > 0 ? brl(metaDia) : "-"} hint={metaDia > 0 ? `${pctMetaDia.toFixed(0)}% atingido` : "sem meta"} />
        <StatCard label="Plano" value={planejamentoDia.length} hint="itens para hoje" />
        <StatCard label="Alertas" value={(atrasadosRaw ?? []).length + manutencoes.length} hint="atrasos + manut." tone="warn" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ActionCard href="/lancamento" title="Lançar produção" subtitle="Novo apontamento" icon={<PlusIcon />} primary />
        <ActionCard href="/planejamento" title="Plano do dia" subtitle="Atividades da equipe" icon={<CalendarIcon />} />
        <ActionCard href="/maquinas" title="Manutenção" subtitle={`${manutencoes.length} pendente(s)`} icon={<WrenchIcon />} />
        <ActionCard href="/resumo" title="Resultados" subtitle="Feed da equipe" icon={<DashboardIcon />} />
      </div>

      <MeuDiaSyncCard />

      <section
        className="rounded-lg border p-3"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
            Planejamento de hoje
          </h2>
          <Link href="/planejamento" className="text-xs font-black" style={{ color: "var(--accent)" }}>
            Ver tudo
          </Link>
        </div>
        {planejamentoDia.length === 0 ? (
          <p className="py-4 text-center text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
            Nenhum item planejado para hoje.
          </p>
        ) : (
          <ul className="space-y-2">
            {planejamentoDia.slice(0, 4).map((item) => (
              <PlanejamentoCard key={item.id} item={item} />
            ))}
          </ul>
        )}
      </section>

      <section
        className="rounded-lg border p-3"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
      >
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
            Ultimos lançamentos
          </h2>
          <Link href="/resumo" className="text-xs font-black" style={{ color: "var(--accent)" }}>
            Feed
          </Link>
        </div>
        {producaoDia.length === 0 ? (
          <p className="py-4 text-center text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
            Ainda sem lançamento hoje.
          </p>
        ) : (
          <ul>
            {producaoDia.slice(0, 5).map((item) => (
              <ProducaoCard key={item.id} item={item} />
            ))}
          </ul>
        )}
      </section>

      {manutencoes.length > 0 && (
        <section
          className="rounded-lg border p-3"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
        >
          <div className="mb-1 flex items-center justify-between gap-3">
            <h2 className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
              Manutenção aberta
            </h2>
            <Link href="/maquinas" className="text-xs font-black" style={{ color: "var(--accent)" }}>
              Resolver
            </Link>
          </div>
          <ul>
            {manutencoes.map((item) => (
              <ManutencaoCard key={item.id} item={item} />
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
