import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { enrichPlanningProgress } from "@/lib/planning-progress";

export const dynamic = "force-dynamic";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const hoje = todayISO();
  const horizonte = addDaysISO(3);
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("planejamento")
    .select("*, projetos(nome), atividades(nome, unidade, valor_unitario), equipes(nome)")
    .not("status", "in", "(concluido,cancelado)")
    .order("data_limite", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const items = await enrichPlanningProgress(supabase, data ?? []);
  const pendentes = items.filter((p) => Number(p.pct_realizado ?? 0) < 100);

  return NextResponse.json({
    hoje,
    horizonte,
    atrasados: pendentes.filter((p) => p.data_limite < hoje),
    noPrazo: pendentes.filter((p) => p.data_limite >= hoje && p.data_limite <= horizonte),
    futuros: pendentes.filter((p) => p.data_limite > horizonte),
  });
}
