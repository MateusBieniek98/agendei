import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const supabase = await createSupabaseServer();
  let q = supabase
    .from("manutencoes")
    .select("*, maquinas(nome, tipo, identificador)")
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data });
}

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await req.json();
  const { maquina_id, descricao, status_maquina } = body;
  if (!maquina_id || !descricao) {
    return NextResponse.json({ error: "campos obrigatórios" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("manutencoes")
    .insert({
      maquina_id,
      descricao,
      reportado_por: profile.id,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // se o encarregado indicou status "parada" ou "manutenção", atualiza máquina.
  // somente admin pode alterar via RLS — então o encarregado abre a manutenção
  // e o admin altera o status na revisão. Pulamos a atualização se não for admin.
  if (profile.role === "admin" && status_maquina) {
    await supabase.from("maquinas").update({ status: status_maquina }).eq("id", maquina_id);
  }

  return NextResponse.json({ item: data }, { status: 201 });
}
