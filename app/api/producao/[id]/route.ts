// PATCH  /api/producao/:id   → edita (admin ou autor)
// DELETE /api/producao/:id   → remove (admin)
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json();

  const supabase = await createSupabaseServer();
  const allowed: Record<string, unknown> = {};
  for (const k of ["data", "equipe_id", "atividade_id", "quantidade", "observacoes"]) {
    if (body[k] !== undefined) allowed[k] = body[k];
  }
  allowed.editado_por = profile.id;

  const { data, error } = await supabase
    .from("producao")
    .update(allowed)
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
  const { error } = await supabase.from("producao").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
