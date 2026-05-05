// Server component que faz fetch agregado e renderiza o dashboard estratégico.
import { getCurrentProfile } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { brl } from "@/lib/format";
import { Card, StatCard } from "@/components/ui/Card";
import { LinhaChart } from "./GestorCharts";

export const dynamic = "force-dynamic";

async function fetchDashboard() {
  // Reproduz a lógica de /api/dashboard rodando no server (sem HTTP roundtrip).
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = await createSupabaseServer();
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = today.getMonth() + 1;
  const inicioMes = `${yyyy}-${String(mm).padStart(2, "0")}-01`;
  const inicioSemana = (() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  })();
  const hoje = today.toISOString().slice(0, 10);

  const [
    { data: serie },
    { data: meta },
    { data: ranking },
    { data: maqStatus },
  ] = await Promise.all([
    supabase.from("v_faturamento_dia").select("*").gte("data", inicioMes),
    supabase.from("metas").select("valor_meta").eq("ano", yyyy).eq("mes", mm).maybeSingle(),
    supabase.from("v_ranking_equipes_mes").select("*"),
    supabase.from("v_status_maquinas").select("*"),
  ]);

  const rows = (serie ?? []) as { data: string; faturamento: number }[];
  const totalMes = rows.reduce((s, r) => s + Number(r.faturamento ?? 0), 0);
  const totalHoje = rows
    .filter((r) => r.data === hoje)
    .reduce((s, r) => s + Number(r.faturamento ?? 0), 0);
  const totalSemana = rows
    .filter((r) => r.data >= inicioSemana)
    .reduce((s, r) => s + Number(r.faturamento ?? 0), 0);
  const valorMeta = Number(meta?.valor_meta ?? 0);
  const restante = Math.max(valorMeta - totalMes, 0);
  const dias = (() => {
    const last = new Date(yyyy, mm, 0).getDate();
    return last - today.getDate() + 1;
  })();
  const metaProxDia = dias > 0 ? restante / dias : 0;
  const pct = valorMeta > 0 ? (totalMes / valorMeta) * 100 : 0;

  type StatusRow = { status: string; total: number };
  const status = (maqStatus ?? []) as StatusRow[];
  const operando = Number(status.find((s) => s.status === "operando")?.total ?? 0);
  const paradas = Number(status.find((s) => s.status === "parada")?.total ?? 0);
  const urgentes = Number(
    status.find((s) => s.status === "manutencao_urgente")?.total ?? 0
  );

  return {
    hoje: totalHoje,
    semana: totalSemana,
    mes: totalMes,
    meta: valorMeta,
    pct,
    metaProxDia,
    serie: rows,
    ranking: (ranking ?? []) as { id: string; nome: string; faturamento: number }[],
    maquinas: { operando, paradas, urgentes },
  };
}

export default async function GestorPage() {
  const data = await fetchDashboard();
  if (!data) return null;
  const totalFrota = data.maquinas.operando + data.maquinas.paradas + data.maquinas.urgentes;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Faturamento — hoje"
          value={brl(data.hoje)}
          tone="positive"
        />
        <StatCard label="Semana (7d)" value={brl(data.semana)} />
        <StatCard label="Mês corrente" value={brl(data.mes)} />
        <StatCard
          label="Meta atingida"
          value={`${data.pct.toFixed(1)}%`}
          tone={data.pct >= 100 ? "positive" : data.pct >= 70 ? "neutral" : "warning"}
          hint={`Meta: ${brl(data.meta)}`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 md:col-span-2">
          <h3 className="font-semibold">Produção diária no mês</h3>
          <LinhaChart serie={data.serie} />
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold">Meta do próximo dia</h3>
          <p className="mt-3 text-3xl font-bold text-[var(--color-gn-700)] tabular">
            {brl(data.metaProxDia)}
          </p>
          <p className="text-xs text-[var(--color-ink-500)] mt-1">
            Calculada como (meta − faturado) ÷ dias restantes.
          </p>
          <div className="mt-4 h-3 w-full rounded-full bg-[var(--color-ink-100)] overflow-hidden">
            <div
              className="h-full bg-[var(--color-gn-500)] transition-all"
              style={{ width: `${Math.min(data.pct, 100)}%` }}
            />
          </div>
          <p className="text-xs text-[var(--color-ink-500)] mt-2">
            {brl(data.mes)} de {brl(data.meta)}
          </p>
        </Card>
      </div>

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
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold">Top equipes do mês</h3>
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
                <span className="font-semibold tabular">{brl(e.faturamento)}</span>
              </li>
            ))}
            {data.ranking.length === 0 && (
              <li className="text-sm text-[var(--color-ink-500)]">Sem dados ainda.</li>
            )}
          </ol>
        </Card>
      </div>
    </div>
  );
}
