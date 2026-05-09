import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { upsertServiceMetadata } from "@/lib/service-metadata";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const body = await req.json();
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("atividades")
    .update(body)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

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

  return NextResponse.json({ item: data, syncWarning });
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
