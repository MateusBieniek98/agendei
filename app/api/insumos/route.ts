import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function parseInsumoPayload(raw: unknown, partial = false) {
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
  } else if (!partial) {
    return { error: "Nome do insumo é obrigatório.", payload: null };
  }

  if (body.grupo !== undefined) {
    const grupo = cleanText(body.grupo);
    if (!grupo) return { error: "Grupo do insumo é obrigatório.", payload: null };
    payload.grupo = grupo;
  } else if (!partial) {
    payload.grupo = "Operacional";
  }

  if (body.unidade !== undefined) {
    const unidade = cleanText(body.unidade);
    if (!unidade) return { error: "Unidade do insumo é obrigatória.", payload: null };
    payload.unidade = unidade;
  } else if (!partial) {
    payload.unidade = "un";
  }

  if (body.estoque_minimo !== undefined) {
    const estoqueMinimo = Number(body.estoque_minimo);
    if (!Number.isFinite(estoqueMinimo) || estoqueMinimo < 0) {
      return { error: "Estoque mínimo inválido.", payload: null };
    }
    payload.estoque_minimo = estoqueMinimo;
  } else if (!partial) {
    payload.estoque_minimo = 0;
  }

  if (body.ativo !== undefined) payload.ativo = Boolean(body.ativo);

  if (Object.keys(payload).length === 0) {
    return { error: "Nenhum campo válido.", payload: null };
  }

  return { error: null, payload };
}

export async function GET(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const includeInactive =
    profile.role === "admin" && req.nextUrl.searchParams.get("include_inactive") === "1";
  const supabase = await createSupabaseServer();
  let query = supabase.from("insumos").select("*").order("nome");
  if (!includeInactive) query = query.eq("ativo", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = parseInsumoPayload(await req.json().catch(() => null));
  if (parsed.error || !parsed.payload) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("insumos")
    .insert(parsed.payload)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ item: data }, { status: 201 });
}
