import type { SupabaseClient } from "@supabase/supabase-js";
import type { MentionableProfile, UserRole } from "@/lib/types";

export type TenantProfileSummary = MentionableProfile & { email: string | null };

export async function loadTenantProfiles(
  supabase: SupabaseClient,
  organizationId: string,
  values: Array<string | null | undefined>
) {
  const userIds = Array.from(new Set(values.filter((id): id is string => Boolean(id))));
  const result = new Map<string, TenantProfileSummary>();
  if (userIds.length === 0) return result;

  const [{ data: memberships, error: membershipsError }, { data: profiles, error: profilesError }] =
    await Promise.all([
      supabase
        .from("organization_members")
        .select("user_id,role,equipe_id")
        .eq("organization_id", organizationId)
        .in("user_id", userIds),
      supabase.from("profiles").select("id,nome,email").in("id", userIds),
    ]);
  if (membershipsError) throw membershipsError;
  if (profilesError) throw profilesError;

  const teamIds = Array.from(
    new Set(
      (memberships ?? [])
        .map((membership) => membership.equipe_id as string | null)
        .filter((id): id is string => Boolean(id))
    )
  );
  const teams = teamIds.length
    ? await supabase
        .from("equipes")
        .select("id,nome")
        .eq("organization_id", organizationId)
        .in("id", teamIds)
    : { data: [], error: null };
  if (teams.error) throw teams.error;

  const profileById = new Map((profiles ?? []).map((profile) => [String(profile.id), profile]));
  const teamById = new Map((teams.data ?? []).map((team) => [String(team.id), String(team.nome)]));
  for (const membership of memberships ?? []) {
    const id = String(membership.user_id);
    const profile = profileById.get(id);
    if (!profile) continue;
    const equipeId = membership.equipe_id ? String(membership.equipe_id) : null;
    result.set(id, {
      id,
      nome: String(profile.nome),
      email: profile.email ? String(profile.email) : null,
      role: membership.role as UserRole,
      equipe_id: equipeId,
      equipes: equipeId ? { nome: teamById.get(equipeId) ?? "Equipe indisponível" } : null,
    });
  }
  return result;
}
