import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function cleanId(value: unknown) {
  const id = String(value ?? "").trim();
  return id ? id : null;
}

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("metas_atividades")
    .select(
      "*, atividades(nome, unidade, valor_unitario), equipes(nome), profiles(nome, email, role)"
    )
    .order("ano", { ascending: false })
    .order("mes", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const ano = Number(body.ano);
  const mes = Number(body.mes);
  const atividade_id = cleanId(body.atividade_id);
  const profile_id = cleanId(body.profile_id);
  const equipe_id = profile_id ? null : cleanId(body.equipe_id);
  const quantidade_meta = Number(body.quantidade_meta);
  const observacoes = cleanText(body.observacoes);

  if (
    !Number.isInteger(ano) ||
    !Number.isInteger(mes) ||
    mes < 1 ||
    mes > 12 ||
    !atividade_id ||
    !Number.isFinite(quantidade_meta) ||
    quantidade_meta < 0
  ) {
    return NextResponse.json(
      { error: "ano, mês, atividade e meta são obrigatórios" },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServer();

  let existing = supabase
    .from("metas_atividades")
    .select("id")
    .eq("ano", ano)
    .eq("mes", mes)
    .eq("atividade_id", atividade_id);

  if (profile_id) {
    existing = existing.eq("profile_id", profile_id);
  } else {
    existing = existing.is("profile_id", null);
    existing = equipe_id ? existing.eq("equipe_id", equipe_id) : existing.is("equipe_id", null);
  }

  const { data: found, error: findError } = await existing.maybeSingle();
  if (findError) return NextResponse.json({ error: findError.message }, { status: 400 });

  const payload = {
    ano,
    mes,
    atividade_id,
    equipe_id,
    profile_id,
    quantidade_meta,
    observacoes,
  };

  const mutation = found?.id
    ? supabase.from("metas_atividades").update(payload).eq("id", found.id)
    : supabase.from("metas_atividades").insert(payload);

  const { data, error } = await mutation
    .select(
      "*, atividades(nome, unidade, valor_unitario), equipes(nome), profiles(nome, email, role)"
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ item: data }, { status: found?.id ? 200 : 201 });
}

export async function DELETE(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { error } = await supabase.from("metas_atividades").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
