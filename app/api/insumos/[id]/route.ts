import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function parseInsumoPayload(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Dados inválidos.", payload: null };
  }

  const body = raw as Record<string, unknown>;
  const payload: Record<string, unknown> = {};

  if (body.codigo !== undefined) payload.codigo = cleanText(body.codigo);
  if (body.nome !== undefined) {
    const nome = cleanText(body.nome);
    if (!nome) return { error: "Nome do insumo é obrigatório.", payload: null };
    payload.nome = nome;
  }
  if (body.grupo !== undefined) {
    const grupo = cleanText(body.grupo);
    if (!grupo) return { error: "Grupo do insumo é obrigatório.", payload: null };
    payload.grupo = grupo;
  }
  if (body.unidade !== undefined) {
    const unidade = cleanText(body.unidade);
    if (!unidade) return { error: "Unidade do insumo é obrigatória.", payload: null };
    payload.unidade = unidade;
  }
  if (body.estoque_minimo !== undefined) {
    const estoqueMinimo = Number(body.estoque_minimo);
    if (!Number.isFinite(estoqueMinimo) || estoqueMinimo < 0) {
      return { error: "Estoque mínimo inválido.", payload: null };
    }
    payload.estoque_minimo = estoqueMinimo;
  }
  if (body.ativo !== undefined) payload.ativo = Boolean(body.ativo);

  if (Object.keys(payload).length === 0) {
    return { error: "Nenhum campo válido para atualizar.", payload: null };
  }

  return { error: null, payload };
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const parsed = parseInsumoPayload(await req.json().catch(() => null));
  if (parsed.error || !parsed.payload) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("insumos")
    .update(parsed.payload)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ item: data });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("insumos")
    .update({ ativo: false })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ item: data });
}
