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

  // se marcou como resolvido, registra a data
  const patch: Record<string, unknown> = { ...body };
  if (body.status === "resolvido" && !body.resolvido_em) {
    patch.resolvido_em = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("manutencoes")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ item: data });
}
