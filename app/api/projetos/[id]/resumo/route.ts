import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { dataOperacionalISO, PRESETS, resolvePreset, type PeriodoPreset } from "@/lib/period";

type Ctx = { params: Promise<{ id: string }> };

function number(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const presetValue = sp.get("preset") ?? "ciclo_atual";
  const preset = presetValue in PRESETS ? presetValue as PeriodoPreset : "ciclo_atual";
  const periodo = resolvePreset(preset, { de: sp.get("de") ?? "", ate: sp.get("ate") ?? "" });
  const talhaoId = sp.get("talhao_id");
  const supabase = await createSupabaseServer();

  let productionQuery = supabase
    .from("producao")
    .select("data, talhao_id, atividade_id, quantidade, valor_unitario_snapshot, atividades(nome, unidade)")
    .eq("projeto_id", id)
    .gte("data", periodo.de)
    .lte("data", periodo.ate)
    .limit(10000);
  let planningQuery = supabase
    .from("planejamento")
    .select("talhao_id, atividade_id, quantidade_prevista, status, data_limite, atividades(nome, unidade)")
    .eq("projeto_id", id)
    .gte("data_limite", periodo.de)
    .lte("data_limite", periodo.ate)
    .limit(5000);
  let maintenanceQuery = supabase
    .from("manutencoes")
    .select("id, talhao_id")
    .eq("projeto_id", id)
    .neq("status", "resolvido")
    .limit(5000);
  let allocationQuery = supabase
    .from("alocacoes_operacionais")
    .select("*, projetos(nome), talhoes(id, codigo, area_ha, ativo), equipes(nome), maquinas(nome, identificador, status), autor:profiles!alocacoes_operacionais_alocado_por_fkey(nome)")
    .eq("projeto_id", id)
    .is("encerrado_em", null)
    .limit(5000);

  if (talhaoId) {
    productionQuery = productionQuery.eq("talhao_id", talhaoId);
    planningQuery = planningQuery.eq("talhao_id", talhaoId);
    maintenanceQuery = maintenanceQuery.eq("talhao_id", talhaoId);
    allocationQuery = allocationQuery.eq("talhao_id", talhaoId);
  }

  const [projectResult, plotsResult, productionResult, planningResult, maintenanceResult, allocationResult] = await Promise.all([
    supabase.from("projetos").select("*").eq("id", id).maybeSingle(),
    supabase.from("talhoes").select("*").eq("projeto_id", id).eq("ativo", true).order("codigo"),
    productionQuery,
    planningQuery,
    maintenanceQuery,
    allocationQuery,
  ]);
  const error = projectResult.error ?? plotsResult.error ?? productionResult.error ?? planningResult.error ?? maintenanceResult.error ?? allocationResult.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!projectResult.data) return NextResponse.json({ error: "projeto não encontrado" }, { status: 404 });

  const production = (productionResult.data ?? []) as Array<Record<string, unknown>>;
  const planning = (planningResult.data ?? []) as Array<Record<string, unknown>>;
  const maintenance = (maintenanceResult.data ?? []) as Array<{ id: string; talhao_id: string | null }>;
  const showFinancial = profile.role === "admin" || profile.role === "gestor";
  const today = dataOperacionalISO();
  const daily = new Map<string, number>();
  const activities = new Map<string, { atividade_id: string; nome: string; unidade: string; previsto: number; realizado: number }>();
  const plotTotals = new Map<string, { valor: number; lancamentos: number; planejamentos: number; manutencoes: number }>();

  for (const row of production) {
    const quantity = number(row.quantidade);
    const value = showFinancial ? quantity * number(row.valor_unitario_snapshot) : 0;
    const date = String(row.data ?? "");
    if (date) daily.set(date, (daily.get(date) ?? 0) + value);
    const activityId = String(row.atividade_id ?? "");
    const relation = row.atividades as { nome?: string; unidade?: string } | null;
    const activity = activities.get(activityId) ?? { atividade_id: activityId, nome: relation?.nome ?? "Atividade", unidade: relation?.unidade ?? "un", previsto: 0, realizado: 0 };
    activity.realizado += quantity;
    activities.set(activityId, activity);
    const plotId = String(row.talhao_id ?? "");
    if (plotId) {
      const total = plotTotals.get(plotId) ?? { valor: 0, lancamentos: 0, planejamentos: 0, manutencoes: 0 };
      total.valor += value;
      total.lancamentos += 1;
      plotTotals.set(plotId, total);
    }
  }

  for (const row of planning) {
    const activityId = String(row.atividade_id ?? "");
    const relation = row.atividades as { nome?: string; unidade?: string } | null;
    const activity = activities.get(activityId) ?? { atividade_id: activityId, nome: relation?.nome ?? "Atividade", unidade: relation?.unidade ?? "un", previsto: 0, realizado: 0 };
    activity.previsto += number(row.quantidade_prevista);
    activities.set(activityId, activity);
    const plotId = String(row.talhao_id ?? "");
    if (plotId) {
      const total = plotTotals.get(plotId) ?? { valor: 0, lancamentos: 0, planejamentos: 0, manutencoes: 0 };
      total.planejamentos += 1;
      plotTotals.set(plotId, total);
    }
  }
  for (const row of maintenance) {
    if (!row.talhao_id) continue;
    const total = plotTotals.get(row.talhao_id) ?? { valor: 0, lancamentos: 0, planejamentos: 0, manutencoes: 0 };
    total.manutencoes += 1;
    plotTotals.set(row.talhao_id, total);
  }

  const productionValue = production.reduce((sum, row) => sum + (showFinancial ? number(row.quantidade) * number(row.valor_unitario_snapshot) : 0), 0);
  return NextResponse.json({
    projeto: projectResult.data,
    periodo: { de: periodo.de, ate: periodo.ate, label: periodo.label },
    talhoes: (plotsResult.data ?? [])
      .filter((plot) => !talhaoId || plot.id === talhaoId)
      .map((plot) => {
        const total = plotTotals.get(plot.id) ?? { valor: 0, lancamentos: 0, planejamentos: 0, manutencoes: 0 };
        return { ...plot, producao_valor: total.valor, lancamentos: total.lancamentos, planejamentos: total.planejamentos, manutencoes_abertas: total.manutencoes };
      }),
    kpis: {
      area_total_ha: (plotsResult.data ?? []).reduce((sum, plot) => sum + number(plot.area_ha), 0),
      talhoes_ativos: (plotsResult.data ?? []).length,
      producao_valor: productionValue,
      lancamentos: production.length,
      planejamentos: planning.length,
      planejamentos_concluidos: planning.filter((row) => row.status === "concluido").length,
      planejamentos_atrasados: planning.filter((row) => !["concluido", "cancelado"].includes(String(row.status)) && String(row.data_limite) < today).length,
      equipes_alocadas: (allocationResult.data ?? []).filter((row) => row.equipe_id).length,
      maquinas_alocadas: (allocationResult.data ?? []).filter((row) => row.maquina_id).length,
      manutencoes_abertas: maintenance.length,
    },
    serie: Array.from(daily, ([data, valor]) => ({ data, valor })).sort((a, b) => a.data.localeCompare(b.data)),
    por_atividade: Array.from(activities.values()).sort((a, b) => b.realizado - a.realizado),
    alocacoes: allocationResult.data ?? [],
    financeiro_visivel: showFinancial,
  }, { headers: { "cache-control": "no-store" } });
}
