import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { syncPlanningProgressForProduction } from "@/lib/planning-progress";
import { resolveActivePlot } from "@/lib/project-context";

type Ctx = { params: Promise<{ id: string }> };
const STATUSES = ["planejado", "em_execucao", "concluido", "cancelado"] as const;

function isPlanningStatus(value: unknown): value is (typeof STATUSES)[number] {
  return typeof value === "string" && STATUSES.includes(value as never);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await req.json();
  const supabase = await createSupabaseServer();
  const { data: current, error: currentError } = await supabase
    .from("planejamento")
    .select("projeto_id, talhao_id, talhao")
    .eq("id", id)
    .maybeSingle();
  if (currentError) return NextResponse.json({ error: currentError.message }, { status: 400 });
  if (!current) return NextResponse.json({ error: "planejamento não encontrado" }, { status: 404 });

  const update: Record<string, unknown> = {
    ...(body.ano !== undefined ? { ano: Number(body.ano) } : {}),
    ...(body.mes !== undefined ? { mes: Number(body.mes) } : {}),
    ...(typeof body.projeto_id === "string" ? { projeto_id: body.projeto_id } : {}),
    ...(typeof body.talhao === "string" ? { talhao: body.talhao.trim() } : {}),
    ...(typeof body.talhao_id === "string" ? { talhao_id: body.talhao_id } : {}),
    ...(typeof body.atividade_id === "string" ? { atividade_id: body.atividade_id } : {}),
    ...("equipe_id" in body ? { equipe_id: body.equipe_id || null } : {}),
    ...("quantidade_prevista" in body
      ? {
          quantidade_prevista:
            body.quantidade_prevista === "" || body.quantidade_prevista == null
              ? null
              : Number(body.quantidade_prevista),
        }
      : {}),
    ...("data_inicio" in body ? { data_inicio: body.data_inicio || null } : {}),
    ...(typeof body.data_limite === "string" ? { data_limite: body.data_limite } : {}),
    ...(isPlanningStatus(body.status) ? { status: body.status } : {}),
    ...("observacoes" in body ? { observacoes: body.observacoes || null } : {}),
  };

  if (body.projeto_id !== undefined || body.talhao_id !== undefined || body.talhao !== undefined) {
    try {
      const plot = await resolveActivePlot(supabase, {
        projeto_id: update.projeto_id ?? current.projeto_id,
        talhao_id: update.talhao_id ?? current.talhao_id,
        talhao: update.talhao ?? current.talhao,
      });
      update.projeto_id = plot.projeto_id;
      update.talhao_id = plot.id;
      update.talhao = plot.codigo;
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from("planejamento")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const syncError = await syncPlanningProgressForProduction(supabase, data);
  return NextResponse.json({
    item: data,
    planejamento_sync_error: syncError?.message ?? null,
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const supabase = await createSupabaseServer();
  const { error } = await supabase.from("planejamento").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
