// PATCH  /api/producao/:id   → edita (admin ou autor)
// DELETE /api/producao/:id   → remove (admin)
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { syncPlanningProgressForProduction } from "@/lib/planning-progress";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json();

  const supabase = await createSupabaseServer();
  const { data: anterior } = await supabase
    .from("producao")
    .select("projeto_id, talhao, atividade_id")
    .eq("id", id)
    .maybeSingle();

  const allowed: Record<string, unknown> = {};
  for (const k of [
    "data",
    "equipe_id",
    "atividade_id",
    "projeto_id",
    "talhao",
    "quantidade",
    "observacoes",
  ]) {
    if (body[k] !== undefined) allowed[k] = body[k];
  }
  allowed.editado_por = profile.id;

  const { data, error } = await supabase
    .from("producao")
    .update(allowed)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const syncErrors = await Promise.all([
    syncPlanningProgressForProduction(supabase, anterior),
    syncPlanningProgressForProduction(supabase, data),
  ]);

  return NextResponse.json({
    item: data,
    planejamento_sync_error: syncErrors.find(Boolean)?.message ?? null,
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const supabase = await createSupabaseServer();
  const { data: anterior } = await supabase
    .from("producao")
    .select("projeto_id, talhao, atividade_id")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("producao").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const syncError = await syncPlanningProgressForProduction(supabase, anterior);
  return NextResponse.json({ ok: true, planejamento_sync_error: syncError?.message ?? null });
}
