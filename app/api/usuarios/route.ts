// Listagem/atualização de profiles. Criar novos usuários deve ser feito via
// Auth admin (ou convite por e-mail) — fora do escopo desta rota client-safe.

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("profiles")
    .select("*, equipes(nome)")
    .order("nome");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data });
}

export async function PATCH(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id, nome, role, equipe_id, ativo } = await req.json();
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const patch: Record<string, unknown> = {};
  if (nome !== undefined) patch.nome = nome;
  if (role !== undefined) patch.role = role;
  if (equipe_id !== undefined) patch.equipe_id = equipe_id;
  if (ativo !== undefined) patch.ativo = ativo;

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ item: data });
}
