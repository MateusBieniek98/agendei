import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { upsertServiceMetadata } from "@/lib/service-metadata";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("atividades")
    .select("*")
    .order("nome");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data });
}

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.from("atividades").insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  let syncWarning: string | null = null;
  try {
    await upsertServiceMetadata(supabase, {
      serviceKey: data.service_key,
      displayName: data.nome,
      unidade: data.unidade,
      valorUnitario: Number(data.valor_unitario ?? 0),
      sourceSheet: "admin_atividades",
      metadata: { origem: "admin_app" },
    });
  } catch (syncError) {
    syncWarning = syncError instanceof Error ? syncError.message : String(syncError);
  }

  return NextResponse.json({ item: data, syncWarning }, { status: 201 });
}
