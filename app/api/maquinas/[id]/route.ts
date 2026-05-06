import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };
const MACHINE_STATUSES = ["operando", "parada", "manutencao_urgente"] as const;

function isMachineStatus(value: unknown): value is (typeof MACHINE_STATUSES)[number] {
  return typeof value === "string" && MACHINE_STATUSES.includes(value as never);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const profile = await getCurrentProfile();
  if (!profile)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  if (!["admin", "encarregado", "gestor"].includes(profile.role))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = await req.json();
  const supabase = await createSupabaseServer();

  if (profile.role !== "admin") {
    if (Object.keys(body).some((k) => k !== "status") || !isMachineStatus(body.status)) {
      return NextResponse.json({ error: "somente status pode ser alterado" }, { status: 403 });
    }

    const { data, error } = await supabase.rpc("set_machine_status", {
      p_maquina_id: id,
      p_status: body.status,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ item: data });
  }

  const update = {
    ...(typeof body.nome === "string" ? { nome: body.nome } : {}),
    ...(typeof body.tipo === "string" ? { tipo: body.tipo } : {}),
    ...("identificador" in body ? { identificador: body.identificador ?? null } : {}),
    ...(isMachineStatus(body.status) ? { status: body.status } : {}),
    ...(typeof body.ativo === "boolean" ? { ativo: body.ativo } : {}),
  };

  const { data, error } = await supabase
    .from("maquinas")
    .update(update)
    .eq("id", id)
    .select()
    .single();
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
