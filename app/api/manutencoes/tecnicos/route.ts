import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!["admin", "manutencao"].includes(profile.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Configuração do servidor indisponível." }, { status: 500 });
  }
  const { data: memberships, error: membershipsError } = await admin
    .from("organization_members")
    .select("user_id,role")
    .eq("organization_id", profile.active_organization_id!)
    .eq("active", true)
    .eq("role", "manutencao");
  if (membershipsError) {
    return NextResponse.json({ error: membershipsError.message }, { status: 400 });
  }

  const roleByUser = new Map((memberships ?? []).map((item) => [item.user_id, item.role]));
  const userIds = [...roleByUser.keys()];
  if (userIds.length === 0) return NextResponse.json({ items: [] });

  const { data, error } = await admin
    .from("profiles")
    .select("id,nome")
    .in("id", userIds)
    .eq("ativo", true)
    .order("nome");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({
    items: (data ?? []).map((item) => ({
      ...item,
      role: roleByUser.get(item.id) ?? "manutencao",
    })),
  });
}
