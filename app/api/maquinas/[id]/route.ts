import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const body = await req.json();
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.from("maquinas").update(body).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ item: data });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const supabase = await createSupabaseServer();
  const { error } = await supabase.from("maquinas").update({ ativo: false }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
