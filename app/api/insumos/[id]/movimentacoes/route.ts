import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  const tipo = String(body.tipo ?? "entrada").trim();
  const quantidade = Number(body.quantidade ?? 0);
  const observacoes =
    body.observacoes == null || String(body.observacoes).trim() === ""
      ? null
      : String(body.observacoes).trim();

  if (tipo !== "entrada" && tipo !== "ajuste") {
    return NextResponse.json({ error: "Tipo de movimentação inválido." }, { status: 400 });
  }
  if (!Number.isFinite(quantidade) || quantidade === 0) {
    return NextResponse.json({ error: "Quantidade inválida." }, { status: 400 });
  }
  if (tipo === "entrada" && quantidade <= 0) {
    return NextResponse.json({ error: "Entrada deve ter quantidade positiva." }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc("registrar_movimentacao_insumo", {
    p_insumo_id: id,
    p_tipo: tipo,
    p_quantidade: quantidade,
    p_observacoes: observacoes,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ item: data });
}
