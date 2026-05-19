// PATCH  /api/producao/:id   → edita (admin ou autor)
// DELETE /api/producao/:id   → remove (admin)
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { notifyApontamentosSheet } from "@/lib/google-sheets-apontamentos";
import { optionalNumber, sanitizeInsumos } from "@/lib/insumos";
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
    .select("registrado_por, projeto_id, talhao, atividade_id")
    .eq("id", id)
    .maybeSingle();

  if (!anterior) {
    return NextResponse.json({ error: "lançamento não encontrado" }, { status: 404 });
  }

  if (profile.role !== "admin" && anterior.registrado_por !== profile.id) {
    return NextResponse.json(
      { error: "apenas admin ou o autor do lançamento podem editar" },
      { status: 403 }
    );
  }

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
  if (body.insumos !== undefined) allowed.insumos = sanitizeInsumos(body.insumos);
  if (body.descarte !== undefined) allowed.descarte = optionalNumber(body.descarte);
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
  const sheetsSyncError = await notifyApontamentosSheet("editado", data.id);

  return NextResponse.json({
    item: data,
    planejamento_sync_error: syncErrors.find(Boolean)?.message ?? null,
    sheets_sync_error: sheetsSyncError,
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
  const sheetsSyncError = await notifyApontamentosSheet("excluido", id);
  return NextResponse.json({
    ok: true,
    planejamento_sync_error: syncError?.message ?? null,
    sheets_sync_error: sheetsSyncError,
  });
}
