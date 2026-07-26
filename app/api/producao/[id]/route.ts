// PATCH  /api/producao/:id   → edita (admin, autor ou encarregado da equipe no ciclo atual)
// DELETE /api/producao/:id   → remove (admin)
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import { notifyApontamentosSheet } from "@/lib/google-sheets-apontamentos";
import {
  hasOnlyControlledInsumos,
  optionalNumber,
  sanitizeControlledInsumos,
  sanitizeInsumos,
} from "@/lib/insumos";
import { syncPlanningProgressForProduction } from "@/lib/planning-progress";
import { resolvePreset } from "@/lib/period";
import { resolveProductionPlot } from "@/lib/project-context";

type Ctx = { params: Promise<{ id: string }> };

type ProducaoRouteRow = {
  registrado_por: string;
  projeto_id: string | null;
  talhao_id: string | null;
  talhao: string | null;
  atividade_id: string;
  data: string;
  equipe_id: string;
  quantidade: number | string;
  descarte: number | string | null;
  observacoes: string | null;
  insumos: unknown;
  estoque_controlado?: boolean;
};

type ProducaoSyncRow = {
  projeto_id?: string | null;
  talhao?: string | null;
  atividade_id?: string | null;
  estoque_controlado?: boolean;
};

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json();

  const supabase = await createSupabaseServer();
  const { data: anteriorRaw } = await supabase
    .from("producao")
    .select(
      "registrado_por, projeto_id, talhao_id, talhao, atividade_id, data, equipe_id, " +
        "quantidade, descarte, observacoes, insumos, estoque_controlado"
    )
    .eq("id", id)
    .maybeSingle();
  const anterior = anteriorRaw as ProducaoRouteRow | null;

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
    "talhao_id",
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

  if (anterior.estoque_controlado === true) {
    if (body.insumos !== undefined && !hasOnlyControlledInsumos(body.insumos)) {
      return NextResponse.json(
        { error: "Selecione apenas insumos cadastrados no estoque." },
        { status: 400 }
      );
    }

    const finalData = String(allowed.data ?? anterior.data);
    const finalEquipeId = String(allowed.equipe_id ?? anterior.equipe_id);
    const finalAtividadeId = String(allowed.atividade_id ?? anterior.atividade_id);
    const finalProjetoId = String(allowed.projeto_id ?? anterior.projeto_id);
    const finalTalhaoId = body.talhao_id !== undefined
      ? String(body.talhao_id ?? "").trim()
      : String(anterior.talhao_id ?? "").trim();
    const finalTalhao = String(allowed.talhao ?? anterior.talhao ?? "").trim();
    const finalQuantidade = Number(allowed.quantidade ?? anterior.quantidade);
    const finalDescarte =
      body.descarte !== undefined ? optionalNumber(body.descarte) : optionalNumber(anterior.descarte);
    const finalObservacoes =
      allowed.observacoes === undefined
        ? anterior.observacoes ?? null
        : allowed.observacoes == null || String(allowed.observacoes).trim() === ""
        ? null
        : String(allowed.observacoes);
    const finalInsumos =
      body.insumos !== undefined
        ? sanitizeControlledInsumos(body.insumos)
        : sanitizeControlledInsumos(anterior.insumos);

    if (!finalEquipeId || !finalAtividadeId || !finalProjetoId || !finalTalhao || finalQuantidade <= 0) {
      return NextResponse.json({ error: "campos obrigatórios faltando" }, { status: 400 });
    }

    let canonicalProjetoId = finalProjetoId;
    let canonicalTalhao = finalTalhao;
    const locationChanged =
      finalProjetoId !== anterior.projeto_id ||
      finalTalhao !== String(anterior.talhao ?? "").trim() ||
      (!!finalTalhaoId && finalTalhaoId !== anterior.talhao_id);
    if (locationChanged || anterior.talhao_id) {
      try {
        const plot = await resolveProductionPlot(supabase, {
          projeto_id: finalProjetoId,
          talhao_id: finalTalhaoId,
          talhao: finalTalhao,
        });
        canonicalProjetoId = plot.projeto_id;
        canonicalTalhao = plot.codigo;
      } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 400 });
      }
    }

    const { data: rpcData, error } = await supabase.rpc("update_producao_with_stock", {
      p_id: id,
      p_data: finalData,
      p_equipe_id: finalEquipeId,
      p_atividade_id: finalAtividadeId,
      p_projeto_id: canonicalProjetoId,
      p_talhao: canonicalTalhao,
      p_quantidade: finalQuantidade,
      p_descarte: finalDescarte,
      p_observacoes: finalObservacoes,
      p_insumos: finalInsumos,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const data = (rpcData as {
      item?: { id: string; projeto_id?: string | null; talhao?: string | null; atividade_id?: string | null };
    } | null)?.item;
    if (!data?.id) {
      return NextResponse.json({ error: "Resposta inválida ao atualizar apontamento." }, { status: 500 });
    }

    const syncErrors = await Promise.all([
      syncPlanningProgressForProduction(supabase, anterior),
      syncPlanningProgressForProduction(supabase, data),
    ]);
    const sheetsSyncError = await notifyApontamentosSheet("editado", String(data.id));

    return NextResponse.json({
      item: data,
      planejamento_sync_error: syncErrors.find(Boolean)?.message ?? null,
      sheets_sync_error: sheetsSyncError,
    });
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
  const requestedProjetoId = String(allowed.projeto_id ?? anterior.projeto_id ?? "");
  const requestedTalhaoId = allowed.talhao_id == null ? null : String(allowed.talhao_id);
  const requestedTalhao = String(allowed.talhao ?? anterior.talhao ?? "").trim();
  const legacyLocationChanged =
    requestedProjetoId !== String(anterior.projeto_id ?? "") ||
    requestedTalhaoId !== anterior.talhao_id ||
    requestedTalhao !== String(anterior.talhao ?? "").trim();
  if (legacyLocationChanged) {
    try {
      const plot = await resolveProductionPlot(supabase, {
        projeto_id: requestedProjetoId,
        talhao_id: requestedTalhaoId,
        talhao: requestedTalhao,
      });
      allowed.projeto_id = plot.projeto_id;
      allowed.talhao_id = plot.id;
      allowed.talhao = plot.codigo;
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
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
  const { data: anteriorRaw } = await supabase
    .from("producao")
    .select("projeto_id, talhao, atividade_id, estoque_controlado")
    .eq("id", id)
    .maybeSingle();
  const anterior = anteriorRaw as ProducaoSyncRow | null;

  if (anterior?.estoque_controlado === true) {
    const { error } = await supabase.rpc("delete_producao_with_stock", { p_id: id });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else {
    const { error } = await supabase.from("producao").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const syncError = await syncPlanningProgressForProduction(supabase, anterior);
  const sheetsSyncError = await notifyApontamentosSheet("excluido", id);
  return NextResponse.json({
    ok: true,
    planejamento_sync_error: syncError?.message ?? null,
    sheets_sync_error: sheetsSyncError,
  });
}
