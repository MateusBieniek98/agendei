// Endpoint de agregações usado pelos dashboards de admin e gestor.
// Combina meta do mês, faturamento (hoje/semana/mês), produção por atividade,
// ranking de equipes e status das máquinas em uma única chamada.

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { diasRestantesNoMes } from "@/lib/format";

type Row = { data: string; faturamento: number };

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

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
    { data: porAtividade },
    { data: ranking },
    { data: maqStatus },
    { data: manutAbertas },
  ] = await Promise.all([
    supabase
      .from("v_faturamento_dia")
      .select("*")
      .gte("data", inicioMes),
    supabase
      .from("metas")
      .select("valor_meta")
      .eq("ano", yyyy)
      .eq("mes", mm)
      .maybeSingle(),
    supabase.from("v_producao_atividade_mes").select("*"),
    supabase.from("v_ranking_equipes_mes").select("*"),
    supabase.from("v_status_maquinas").select("*"),
    supabase
      .from("manutencoes")
      .select("id, descricao, status, created_at, maquinas(nome, identificador)")
      .neq("status", "resolvido")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const rows: Row[] = (serie ?? []) as Row[];
  const totalMes = rows.reduce((s, r) => s + Number(r.faturamento ?? 0), 0);
  const totalHoje = rows
    .filter((r) => r.data === hoje)
    .reduce((s, r) => s + Number(r.faturamento ?? 0), 0);
  const totalSemana = rows
    .filter((r) => r.data >= inicioSemana)
    .reduce((s, r) => s + Number(r.faturamento ?? 0), 0);

  const valorMeta = Number(meta?.valor_meta ?? 0);
  const restante = Math.max(valorMeta - totalMes, 0);
  const dias = diasRestantesNoMes(today);
  const metaProxDia = dias > 0 ? restante / dias : 0;
  const pctMeta = valorMeta > 0 ? (totalMes / valorMeta) * 100 : 0;

  type StatusRow = { status: string; total: number };
  const statusList: StatusRow[] = (maqStatus ?? []) as StatusRow[];
  const operando = Number(statusList.find((s) => s.status === "operando")?.total ?? 0);
  const paradas = Number(statusList.find((s) => s.status === "parada")?.total ?? 0);
  const urgentes = Number(
    statusList.find((s) => s.status === "manutencao_urgente")?.total ?? 0
  );

  return NextResponse.json({
    hoje: totalHoje,
    semana: totalSemana,
    mes: totalMes,
    meta: valorMeta,
    pctMeta,
    metaProxDia,
    diasRestantes: dias,
    serie: rows,
    porAtividade: porAtividade ?? [],
    ranking: ranking ?? [],
    maquinas: { operando, paradas, urgentes },
    manutencoesAbertas: manutAbertas ?? [],
  });
}
