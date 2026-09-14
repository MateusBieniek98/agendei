import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Configuração do servidor indisponível." }, { status: 500 });
  }

  const { data: memberships, error: membershipsError } = await admin
    .from("organization_members")
    .select("user_id,role,equipe_id")
    .eq("organization_id", profile.active_organization_id!)
    .eq("active", true);
  if (membershipsError) {
    return NextResponse.json({ error: membershipsError.message }, { status: 400 });
  }

  const userIds = (memberships ?? []).map((item) => item.user_id);
  if (userIds.length === 0) return NextResponse.json({ items: [] });

  const membershipByUser = new Map(
    (memberships ?? []).map((item) => [item.user_id, item])
  );
  const teamIds = [...new Set(
    (memberships ?? []).map((item) => item.equipe_id).filter((id): id is string => Boolean(id))
  )];

  const [{ data, error }, { data: teams, error: teamsError }] = await Promise.all([
    admin.from("profiles").select("id,nome").in("id", userIds).eq("ativo", true).order("nome"),
    teamIds.length > 0
      ? admin
          .from("equipes")
          .select("id,nome")
          .eq("organization_id", profile.active_organization_id!)
          .in("id", teamIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (teamsError) return NextResponse.json({ error: teamsError.message }, { status: 400 });
  const teamById = new Map((teams ?? []).map((team) => [team.id, team.nome]));

  return NextResponse.json({
    items: (data ?? []).map((item) => ({
      id: item.id,
      nome: item.nome,
      role: membershipByUser.get(item.id)?.role ?? "encarregado",
      equipe_id: membershipByUser.get(item.id)?.equipe_id ?? null,
      equipes: membershipByUser.get(item.id)?.equipe_id
        ? { nome: teamById.get(membershipByUser.get(item.id)!.equipe_id!) ?? null }
        : null,
    })),
  });
}
