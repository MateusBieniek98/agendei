import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id: projeto_id } = await ctx.params;
  const body = await req.json();
  const codigo = String(body.codigo ?? "").trim();

  if (!codigo) {
    return NextResponse.json({ error: "código do talhão obrigatório" }, { status: 400 });
  }

  const payload = {
    projeto_id,
    codigo,
    area_ha: body.area_ha === "" || body.area_ha == null ? null : Number(body.area_ha),
    ativo: body.ativo ?? true,
    observacoes: body.observacoes ? String(body.observacoes).trim() : null,
  };

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("talhoes")
    .upsert(payload, { onConflict: "projeto_id,codigo" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ item: data }, { status: 201 });
}
