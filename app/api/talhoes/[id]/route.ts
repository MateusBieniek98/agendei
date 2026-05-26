import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await req.json();
  const update = {
    ...(typeof body.codigo === "string" ? { codigo: body.codigo.trim() } : {}),
    ...("area_ha" in body
      ? { area_ha: body.area_ha === "" || body.area_ha == null ? null : Number(body.area_ha) }
      : {}),
    ...(typeof body.ativo === "boolean" ? { ativo: body.ativo } : {}),
    ...("observacoes" in body
      ? { observacoes: body.observacoes ? String(body.observacoes).trim() : null }
      : {}),
  };

  if ("codigo" in update && !update.codigo) {
    return NextResponse.json({ error: "código do talhão obrigatório" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("talhoes")
    .update(update)
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
  const { error } = await supabase.from("talhoes").update({ ativo: false }).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
