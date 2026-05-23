// PATCH  /api/producao/:id   → edita (admin, autor ou encarregado da equipe no ciclo atual)
// DELETE /api/producao/:id   → remove (admin)
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import { notifyApontamentosSheet } from "@/lib/google-sheets-apontamentos";
import { optionalNumber, sanitizeInsumos } from "@/lib/insumos";
import { syncPlanningProgressForProduction } from "@/lib/planning-progress";
import { resolvePreset } from "@/lib/period";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json();

  const supabase = await createSupabaseServer();
  const { data: anterior } = await supabase
    .from("producao")
    .select("registrado_por, projeto_id, talhao, atividade_id, data, equipe_id")
    .eq("id", id)
    .maybeSingle();

  if (!anterior) {
    return NextResponse.json({ error: "lançamento não encontrado" }, { status: 404 });
  }

  const ciclo = resolvePreset("ciclo_atual");
  const dataAnterior = String(anterior.data);
  const noCicloAtual = dataAnterior >= ciclo.de && dataAnterior <= ciclo.ate;
  const isAdmin = profile.role === "admin";
  const isAuthor = anterior.registrado_por === profile.id;
  const isTeamLead =
    profile.role === "encarregado" &&
    !!profile.equipe_id &&
    profile.equipe_id === anterior.equipe_id;

  if (!isAdmin && (!noCicloAtual || (!isAuthor && !isTeamLead))) {
    return NextResponse.json(
      { error: "apenas admin, autor ou encarregado da equipe podem editar lançamentos do ciclo atual" },
      { status: 403 }
    );
  }

  const allowed: Record<string, unknown> = {};
  for (const k of [
    "data",
    "atividade_id",
    "projeto_id",
    "talhao",
    "quantidade",
    "observacoes",
  ]) {
    if (body[k] !== undefined) allowed[k] = body[k];
  }
  if (body.equipe_id !== undefined) {
    if (!isAdmin && body.equipe_id !== anterior.equipe_id) {
      return NextResponse.json(
        { error: "encarregado não pode transferir apontamento para outra equipe" },
        { status: 403 }
      );
    }
    allowed.equipe_id = body.equipe_id;
  }
  if (!isAdmin && allowed.data !== undefined) {
    const novaData = String(allowed.data);
    if (novaData < ciclo.de || novaData > ciclo.ate) {
      return NextResponse.json(
        { error: "edição permitida apenas dentro do ciclo atual" },
        { status: 403 }
      );
    }
  }
  if (body.insumos !== undefined) allowed.insumos = sanitizeInsumos(body.insumos);
  if (body.descarte !== undefined) allowed.descarte = optionalNumber(body.descarte);
  if (body.atividade_id !== undefined && body.atividade_id !== anterior.atividade_id) {
    const { data: atividade, error: atividadeError } = await supabase
      .from("atividades")
      .select("valor_unitario, ativo")
      .eq("id", body.atividade_id)
      .maybeSingle();

    if (atividadeError || !atividade || !atividade.ativo) {
      return NextResponse.json({ error: "atividade inválida" }, { status: 400 });
    }

    allowed.valor_unitario_snapshot = atividade.valor_unitario;
  }
  allowed.editado_por = profile.id;

  const needsElevatedWrite = !isAdmin && !isAuthor && isTeamLead;
  const writeClient = needsElevatedWrite ? createSupabaseAdminClient() : supabase;
  if (!writeClient) {
    return NextResponse.json(
      { error: "edição de apontamentos da equipe requer SUPABASE_SERVICE_ROLE_KEY configurada" },
      { status: 500 }
    );
  }

  const { data, error } = await writeClient
    .from("producao")
    .update(allowed)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const syncErrors = await Promise.all([
    syncPlanningProgressForProduction(writeClient, anterior),
    syncPlanningProgressForProduction(writeClient, data),
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
