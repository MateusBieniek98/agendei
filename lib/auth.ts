import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "./supabase/server";
import type {
  Organization,
  OrganizationMembership,
  OrganizationSettings,
  Profile,
  TenantContext,
  UserRole,
} from "./types";
import { ROLE_HOME } from "./types";

type MembershipQueryRow = OrganizationMembership & {
  organizations: Organization | null;
};

function onlyActiveProfile(profile: Profile | null): Profile | null {
  if (!profile || profile.ativo === false) return null;
  return profile;
}

export const getCurrentTenantContext = cache(
  async (): Promise<TenantContext | null> => {
    const supabase = await createSupabaseServer();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", auth.user.id)
      .maybeSingle();
    const baseProfile = onlyActiveProfile((profileData as Profile | null) ?? null);
    if (!baseProfile) return null;

    const { data: membershipsData } = await supabase
      .from("organization_members")
      .select(
        "organization_id,user_id,role,equipe_id,active,invited_by,joined_at,created_at,updated_at,organizations:organizations(*)"
      )
      .eq("user_id", auth.user.id)
      .eq("active", true)
      .order("created_at", { ascending: true });

    const memberships = (membershipsData ?? []) as unknown as MembershipQueryRow[];
    const selected =
      memberships.find(
        (membership) =>
          membership.organization_id === baseProfile.active_organization_id
      ) ?? memberships[0];

    if (!selected?.organizations) return null;

    if (baseProfile.active_organization_id !== selected.organization_id) {
      const { error: switchError } = await supabase.rpc("switch_active_organization", {
        p_organization_id: selected.organization_id,
      });
      if (switchError) return null;
    }

    const { data: settingsData } = await supabase
      .from("organization_settings")
      .select("*")
      .eq("organization_id", selected.organization_id)
      .maybeSingle();

    const profile: Profile = {
      ...baseProfile,
      role: selected.role,
      equipe_id: selected.equipe_id,
      active_organization_id: selected.organization_id,
    };

    return {
      profile,
      organization: selected.organizations,
      membership: {
        organization_id: selected.organization_id,
        user_id: selected.user_id,
        role: selected.role,
        equipe_id: selected.equipe_id,
        active: selected.active,
        invited_by: selected.invited_by,
        joined_at: selected.joined_at,
        created_at: selected.created_at,
        updated_at: selected.updated_at,
      },
      settings: (settingsData as OrganizationSettings | null) ?? null,
      availableOrganizations: memberships
        .filter((membership) => membership.organizations)
        .map((membership) => ({
          organization: membership.organizations!,
          membership: {
            organization_id: membership.organization_id,
            user_id: membership.user_id,
            role: membership.role,
            equipe_id: membership.equipe_id,
            active: membership.active,
            invited_by: membership.invited_by,
            joined_at: membership.joined_at,
            created_at: membership.created_at,
            updated_at: membership.updated_at,
          },
        })),
    };
  }
);

/** Carrega o perfil já projetado com papel e equipe da organização ativa. */
export async function getCurrentProfile(): Promise<Profile | null> {
  return (await getCurrentTenantContext())?.profile ?? null;
}

/** Carrega sessão e tenant separadamente para diagnosticar redirects. */
export async function getCurrentAuthContext(): Promise<{
  hasUser: boolean;
  profile: Profile | null;
  tenant: TenantContext | null;
}> {
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { hasUser: false, profile: null, tenant: null };

  const tenant = await getCurrentTenantContext();
  return { hasUser: true, profile: tenant?.profile ?? null, tenant };
}

export async function requireTenantContext(): Promise<TenantContext> {
  const tenant = await getCurrentTenantContext();
  if (!tenant) redirect("/login?erro=organizacao");
  if (
    tenant.organization.status === "suspended" ||
    tenant.organization.status === "cancelled"
  ) {
    redirect("/organizacao-suspensa");
  }
  return tenant;
}

/** Garante que existe sessão e uma organização operacional. */
export async function requireSession(): Promise<Profile> {
  return (await requireTenantContext()).profile;
}

/** Garante que o papel da associação ativa é permitido. */
export async function requireRole(allowed: UserRole[]): Promise<Profile> {
  const profile = await requireSession();
  if (!allowed.includes(profile.role)) redirect(ROLE_HOME[profile.role]);
  return profile;
}

export async function isCurrentUserPlatformAdmin() {
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;
  const { data, error } = await supabase.rpc("is_platform_admin");
  return !error && data === true;
}

export async function getPlatformMfaStatus() {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) return { currentLevel: null, nextLevel: null };
  return {
    currentLevel: data.currentLevel,
    nextLevel: data.nextLevel,
  };
}

export async function requirePlatformAdmin(options: { requireMfa?: boolean } = {}) {
  if (!(await isCurrentUserPlatformAdmin())) redirect("/");
  if (options.requireMfa) {
    const assurance = await getPlatformMfaStatus();
    if (assurance.currentLevel !== "aal2") redirect("/seguranca/mfa");
  }
}
