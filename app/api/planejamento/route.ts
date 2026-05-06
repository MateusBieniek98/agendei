import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { enrichPlanningProgress, syncPlanningProgressForProduction } from "@/lib/planning-progress";

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

  const ano = sp.get("ano");
  const mes = sp.get("mes");
  const status = sp.get("status");
  if (ano) q = q.eq("ano", Number(ano));
  if (mes) q = q.eq("mes", Number(mes));
  if (status && isPlanningStatus(status)) q = q.eq("status", status);

  const { data, error } = await q.limit(800);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const items = await enrichPlanningProgress(supabase, data ?? []);
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const required = ["ano", "mes", "projeto_id", "talhao", "atividade_id", "data_limite"];
  if (required.some((k) => body[k] === undefined || body[k] === null || body[k] === "")) {
    return NextResponse.json({ error: "campos obrigatórios faltando" }, { status: 400 });
  }
  if (body.status && !isPlanningStatus(body.status)) {
    return NextResponse.json({ error: "status inválido" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("planejamento")
    .insert({
      ano: Number(body.ano),
      mes: Number(body.mes),
      projeto_id: body.projeto_id,
      talhao: String(body.talhao).trim(),
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
