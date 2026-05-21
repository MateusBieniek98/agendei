import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { upsertServiceMetadata } from "@/lib/service-metadata";

type Ctx = { params: Promise<{ id: string }> };

function parseAtividadePayload(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Dados inválidos.", payload: null };
  }

  const body = raw as Record<string, unknown>;
  const payload: Record<string, unknown> = {};

  if (body.nome !== undefined) {
    const nome = String(body.nome).trim();
    if (!nome) return { error: "Nome da atividade é obrigatório.", payload: null };
    payload.nome = nome;
  }

  if (body.unidade !== undefined) {
    const unidade = String(body.unidade).trim();
    if (!unidade) return { error: "Unidade da atividade é obrigatória.", payload: null };
    payload.unidade = unidade;
  }

  if (body.valor_unitario !== undefined) {
    const valorUnitario = Number(body.valor_unitario);
    if (!Number.isFinite(valorUnitario) || valorUnitario < 0) {
      return { error: "Valor unitário inválido.", payload: null };
    }
    payload.valor_unitario = valorUnitario;
  }

  if (body.ativo !== undefined) payload.ativo = Boolean(body.ativo);

  if (Object.keys(payload).length === 0) {
    return { error: "Nenhum campo válido para atualizar.", payload: null };
  }

  return { error: null, payload };
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const parsed = parseAtividadePayload(await req.json().catch(() => null));
  if (parsed.error || !parsed.payload) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const { data: anterior, error: beforeError } = await supabase
    .from("atividades")
    .select("valor_unitario")
    .eq("id", id)
    .maybeSingle();

  if (beforeError) return NextResponse.json({ error: beforeError.message }, { status: 400 });
  if (!anterior) return NextResponse.json({ error: "atividade não encontrada" }, { status: 404 });

  const { data, error } = await supabase
    .from("atividades")
    .update(parsed.payload)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  let producaoRecalculada = 0;
  const valorUnitarioMudou =
    parsed.payload.valor_unitario !== undefined &&
    Number(anterior.valor_unitario) !== Number(data.valor_unitario);

  if (valorUnitarioMudou) {
    const { error: producaoError } = await supabase
      .from("producao")
      .update({ valor_unitario_snapshot: data.valor_unitario })
      .eq("atividade_id", id);

    if (producaoError) {
      return NextResponse.json(
        {
          error:
            "Tarifa salva, mas não foi possível recalcular os apontamentos: " +
            producaoError.message,
        },
        { status: 400 }
      );
    }

    const { count, error: countError } = await supabase
      .from("producao")
      .select("id", { count: "exact", head: true })
      .eq("atividade_id", id);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 400 });
    }

    producaoRecalculada = count ?? 0;
  }

  let syncWarning: string | null = null;
  try {
    await upsertServiceMetadata(supabase, {
      serviceKey: data.service_key,
      displayName: data.nome,
      unidade: data.unidade,
      valorUnitario: Number(data.valor_unitario ?? 0),
      sourceSheet: "admin_atividades",
      metadata: { origem: "admin_app", atividade_id: id },
    });
  } catch (syncError) {
    syncWarning = syncError instanceof Error ? syncError.message : String(syncError);
  }

  return NextResponse.json({
    item: data,
    syncWarning,
    producao_recalculada: producaoRecalculada,
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const supabase = await createSupabaseServer();
  // soft-delete pra preservar histórico de produção
  const { error } = await supabase.from("atividades").update({ ativo: false }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await supabase.from("services_metadata").update({ ativo: false }).eq("atividade_id", id);
  return NextResponse.json({ ok: true });
}
