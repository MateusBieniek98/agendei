import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

type MetaPayload = {
  ano: number;
  mes: number;
  valor_meta: number;
  observacoes: string | null;
};

type MetaParseResult =
  | { ok: true; payload: MetaPayload }
  | { ok: false; error: string };

function parseMetaPayload(raw: unknown): MetaParseResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Dados inválidos." };
  }

  const body = raw as Record<string, unknown>;
  const ano = Number(body.ano);
  const mes = Number(body.mes);
  const valorMeta = Number(body.valor_meta);
  const observacoes =
    typeof body.observacoes === "string" && body.observacoes.trim()
      ? body.observacoes.trim()
      : null;

  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) {
    return { ok: false, error: "Ano inválido." };
  }

  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    return { ok: false, error: "Mês inválido." };
  }

  if (!Number.isFinite(valorMeta) || valorMeta < 0) {
    return { ok: false, error: "Valor da meta inválido." };
  }

  return {
    ok: true,
    payload: {
      ano,
      mes,
      valor_meta: valorMeta,
      observacoes,
    },
  };
}

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("metas")
    .select("*")
    .order("ano", { ascending: false })
    .order("mes", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data });
}

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = parseMetaPayload(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const supabase = await createSupabaseServer();
  // upsert por (ano, mes)
  const { data, error } = await supabase
    .from("metas")
    .upsert(parsed.payload, { onConflict: "ano,mes" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ item: data });
}

export async function PUT(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const raw = await req.json().catch(() => null);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const id = String((raw as Record<string, unknown>).id ?? "").trim();
  if (!id) return NextResponse.json({ error: "ID da meta é obrigatório." }, { status: 400 });

  const parsed = parseMetaPayload(raw);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("metas")
    .update(parsed.payload)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ item: data });
}

export async function DELETE(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const id = String(req.nextUrl.searchParams.get("id") ?? "").trim();
  if (!id) return NextResponse.json({ error: "ID da meta é obrigatório." }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { data: meta } = await supabase
    .from("metas")
    .select("ano, mes")
    .eq("id", id)
    .maybeSingle();

  if (meta) {
    await supabase
      .from("metas_equipes")
      .delete()
      .eq("ano", Number(meta.ano))
      .eq("mes", Number(meta.mes));
  }

  const { error } = await supabase.from("metas").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
