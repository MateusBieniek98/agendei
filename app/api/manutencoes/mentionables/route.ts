import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const supabase = admin ?? (await createSupabaseServer());

  const { data, error } = await supabase
    .from("profiles")
    .select("id,nome,role,equipe_id,equipes:equipes!profiles_equipe_fk(nome)")
    .eq("ativo", true)
    .order("nome");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    items: (data ?? []).map((item) => ({
      id: item.id,
      nome: item.nome,
      role: item.role,
      equipe_id: item.equipe_id,
      equipes: item.equipes,
    })),
  });
}
