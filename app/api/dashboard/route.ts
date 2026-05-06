// Endpoint de agregações usado pelos dashboards de admin e gestor.
// Aceita filtro de período: ?preset=ciclo_atual|ciclo_anterior|mes_atual|...
// ou ?de=yyyy-mm-dd&ate=yyyy-mm-dd para custom.

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import {
  resolvePreset,
  diasDecorridos,
  diasRestantes,
  type PeriodoPreset,
} from "@/lib/period";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const presetParam = (sp.get("preset") as PeriodoPreset | null) ?? "ciclo_atual";
  const deCustom = sp.get("de");
  const ateCustom = sp.get("ate");

  const periodo = resolvePreset(
    presetParam,
    deCustom && ateCustom ? { de: deCustom, ate: ateCustom } : undefined
  );

  const supabase = await createSupabaseServer();
  const today = new Date();
  const hoje = today.toISOString().slice(0, 10);

  // Faturamento por dia no período
  const { data: serie } = await supabase
    .from("v_faturamento_dia")
    .select("*")
    .gte("data", periodo.de)
    .lte("data", periodo.ate)
    .order("data");

  // Meta vigente: usa o mês do FIM do período
  const fimMesAno = Number(periodo.ate.slice(0, 4));
  const fimMesMes = Number(periodo.ate.slice(5, 7));
  const { data: meta } = await supabase
    .from("metas")
    .select("valor_meta")
    .eq("ano", fimMesAno)
    .eq("mes", fimMesMes)
    .maybeSingle();

  // Produção por atividade (no período)
  const { data: porAtividade } = await supabase
    .from("producao")
    .select("atividade_id, quantidade, valor_unitario_snapshot, atividades(nome, unidade)")
    .gte("data", periodo.de)
    .lte("data", periodo.ate);

  // Ranking equipes (no período)
  const { data: porEquipe } = await supabase
    .from("producao")
    .select("equipe_id, quantidade, valor_unitario_snapshot, equipes(nome)")
    .gte("data", periodo.de)
    .lte("data", periodo.ate);

  // Status das máquinas + manutenções abertas COM descrição
  const { data: maquinas } = await supabase
    .from("maquinas")
    .select("id, nome, tipo, identificador, status")
    .eq("ativo", true);

  const { data: manutAbertas } = await supabase
    .from("manutencoes")
    .select(
      "id, maquina_id, descricao, status, created_at, resolvido_em, " +
        "talhao, maquinas(nome, tipo, identificador, status), " +
        "equipes(nome), projetos(nome)"
    )
    .neq("status", "resolvido")
    .order("created_at", { ascending: false });

  type SerieRow = { data: string; faturamento: number };
  const rows = (serie ?? []) as SerieRow[];
  const totalPeriodo = rows.reduce((s, r) => s + Number(r.faturamento ?? 0), 0);
  const totalHoje = rows
    .filter((r) => r.data === hoje)
    .reduce((s, r) => s + Number(r.faturamento ?? 0), 0);

  // Faturamento médio por dia: divide pelo número de dias DECORRIDOS
  // (pra refletir o que está acontecendo, não o que ainda vai acontecer)
  const dDecorridos = diasDecorridos(periodo, today);
  const dRestantes = diasRestantes(periodo, today);
  const mediaDia = dDecorridos > 0 ? totalPeriodo / dDecorridos : 0;

  const valorMeta = Number(meta?.valor_meta ?? 0);
  const restanteMeta = Math.max(valorMeta - totalPeriodo, 0);
  const metaProxDia = dRestantes > 0 ? restanteMeta / dRestantes : 0;
  const pctMeta = valorMeta > 0 ? (totalPeriodo / valorMeta) * 100 : 0;

  // Agrega por atividade
  type ProdRow = {
    atividade_id: string;
    quantidade: number;
    valor_unitario_snapshot: number;
    atividades: { nome: string; unidade: string } | null;
  };
  const ativAgg = new Map<
    string,
    { id: string; nome: string; unidade: string; total: number; faturamento: number }
  >();
  for (const p of (porAtividade ?? []) as unknown as ProdRow[]) {
    const key = p.atividade_id;
    const cur = ativAgg.get(key) ?? {
      id: key,
      nome: p.atividades?.nome ?? "?",
      unidade: p.atividades?.unidade ?? "",
      total: 0,
      faturamento: 0,
    };
    cur.total += Number(p.quantidade);
    cur.faturamento += Number(p.quantidade) * Number(p.valor_unitario_snapshot);
    ativAgg.set(key, cur);
  }
  const atividadesArr = [...ativAgg.values()].sort(
    (a, b) => b.faturamento - a.faturamento
  );

  // Agrega por equipe
  type EqRow = {
    equipe_id: string;
    quantidade: number;
    valor_unitario_snapshot: number;
    equipes: { nome: string } | null;
  };
  const eqAgg = new Map<
    string,
    { id: string; nome: string; faturamento: number; lancamentos: number }
  >();
  for (const p of (porEquipe ?? []) as unknown as EqRow[]) {
    const key = p.equipe_id;
    const cur = eqAgg.get(key) ?? {
      id: key,
      nome: p.equipes?.nome ?? "?",
      faturamento: 0,
      lancamentos: 0,
    };
    cur.faturamento += Number(p.quantidade) * Number(p.valor_unitario_snapshot);
    cur.lancamentos += 1;
    eqAgg.set(key, cur);
  }
  const equipesArr = [...eqAgg.values()].sort(
    (a, b) => b.faturamento - a.faturamento
  );

  // Status frota
  type Maq = { status: string };
  const maqArr = (maquinas ?? []) as Maq[];
  const operando = maqArr.filter((m) => m.status === "operando").length;
  const paradas = maqArr.filter((m) => m.status === "parada").length;
  const urgentes = maqArr.filter((m) => m.status === "manutencao_urgente").length;

  return NextResponse.json({
    periodo: {
      de: periodo.de,
      ate: periodo.ate,
      label: periodo.label,
      diasTotais: periodo.diasTotais,
      diasDecorridos: dDecorridos,
      diasRestantes: dRestantes,
    },
    hoje: totalHoje,
    total: totalPeriodo,
    mediaDia,
    meta: valorMeta,
    pctMeta,
    metaProxDia,
    serie: rows,
    porAtividade: atividadesArr,
    ranking: equipesArr,
    maquinas: { operando, paradas, urgentes, total: maqArr.length },
    manutencoesAbertas: manutAbertas ?? [],
  });
}
