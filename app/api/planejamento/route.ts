import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { enrichPlanningProgress, syncPlanningProgressForProduction } from "@/lib/planning-progress";
import { resolveActivePlot } from "@/lib/project-context";

const STATUSES = ["planejado", "em_execucao", "concluido", "cancelado"] as const;

function isPlanningStatus(value: unknown): value is (typeof STATUSES)[number] {
  return typeof value === "string" && STATUSES.includes(value as never);
}

export async function GET(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const supabase = await createSupabaseServer();
  let q = supabase
    .from("planejamento")
    .select(
      "*, projetos(nome), atividades(nome, unidade, valor_unitario), equipes(nome)"
    )
    .order("data_limite", { ascending: true })
    .order("created_at", { ascending: false });

  const ano      = sp.get("ano");
  const mes      = sp.get("mes");
  const status   = sp.get("status");
  const equipeId = sp.get("equipe_id");
  const projetoId = sp.get("projeto_id");
  const talhaoId = sp.get("talhao_id");

  if (ano)      q = q.eq("ano",      Number(ano));
  if (mes)      q = q.eq("mes",      Number(mes));
  if (status && isPlanningStatus(status)) q = q.eq("status", status);
  if (equipeId) q = q.eq("equipe_id", equipeId);
  if (projetoId) q = q.eq("projeto_id", projetoId);
  if (talhaoId) q = q.eq("talhao_id", talhaoId);

  const { data, error } = await q.limit(800);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const items = await enrichPlanningProgress(supabase, data ?? []);
  return NextResponse.json(
    { items },
    { headers: { "cache-control": "no-store" } }
  );
}

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const required = ["ano", "mes", "projeto_id", "atividade_id", "data_limite"];
  if (required.some((k) => body[k] === undefined || body[k] === null || body[k] === "")) {
    return NextResponse.json({ error: "campos obrigatórios faltando" }, { status: 400 });
  }
  if (body.status && !isPlanningStatus(body.status)) {
    return NextResponse.json({ error: "status inválido" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  let plot;
  try {
    plot = await resolveActivePlot(supabase, body);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("planejamento")
    .insert({
      ano: Number(body.ano),
      mes: Number(body.mes),
      projeto_id: plot.projeto_id,
      talhao_id: plot.id,
      talhao: plot.codigo,
      atividade_id: body.atividade_id,
      equipe_id: body.equipe_id || null,
      quantidade_prevista:
        body.quantidade_prevista === "" || body.quantidade_prevista == null
          ? null
          : Number(body.quantidade_prevista),
      data_inicio: body.data_inicio || null,
      data_limite: body.data_limite,
      status: body.status ?? "planejado",
      observacoes: body.observacoes || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const syncError = await syncPlanningProgressForProduction(supabase, data);
  return NextResponse.json(
    { item: data, planejamento_sync_error: syncError?.message ?? null },
    { status: 201 }
  );
}
