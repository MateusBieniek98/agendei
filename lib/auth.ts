import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "./supabase/server";
import { createSupabaseAdminClient } from "./supabase/admin";
import type {
  Organization,
  OrganizationMembership,
  OrganizationSettings,
  PlatformSupportSession,
  Profile,
  TenantContext,
  UserRole,
} from "./types";
import { ROLE_HOME } from "./types";
import {
  createLegacyTenantContext,
  isTenantSchemaUnavailable,
  legacySingleTenantEnabled,
} from "./tenant-transition";

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

    const { data: membershipsData, error: membershipsError } = await supabase
      .from("organization_members")
      .select(
        "organization_id,user_id,role,equipe_id,active,invited_by,joined_at,created_at,updated_at,organizations:organizations(*)"
      )
      .eq("user_id", auth.user.id)
      .eq("active", true)
      .order("created_at", { ascending: true });

    if (membershipsError) {
      if (
        legacySingleTenantEnabled() &&
        isTenantSchemaUnavailable(membershipsError)
      ) {
        return createLegacyTenantContext(baseProfile);
      }
      return null;
    }

    const memberships = (membershipsData ?? []) as unknown as MembershipQueryRow[];
    const { data: platformAdmin } = await supabase.rpc("is_platform_admin");

    if (platformAdmin === true) {
      const admin = createSupabaseAdminClient();
      const { data: supportData } = admin
        ? await admin
            .from("platform_support_sessions")
            .select("id,organization_id,reason,started_at,expires_at")
            .eq("actor_id", auth.user.id)
            .is("ended_at", null)
            .gt("expires_at", new Date().toISOString())
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : { data: null };
      const supportSession = supportData as PlatformSupportSession | null;

      if (supportSession && admin) {
        const [{ data: organizationData }, { data: settingsData }] =
          await Promise.all([
            admin
              .from("organizations")
              .select("*")
              .eq("id", supportSession.organization_id)
              .maybeSingle(),
            admin
              .from("organization_settings")
              .select("*")
              .eq("organization_id", supportSession.organization_id)
              .maybeSingle(),
          ]);
        const organization = organizationData as Organization | null;
        if (!organization) return null;

        const membership: OrganizationMembership = {
          organization_id: organization.id,
          user_id: baseProfile.id,
          role: "admin",
          equipe_id: null,
          active: true,
          invited_by: null,
          joined_at: supportSession.started_at,
          created_at: supportSession.started_at,
          updated_at: supportSession.started_at,
        };
        const profile: Profile = {
          ...baseProfile,
          role: "admin",
          equipe_id: null,
          active_organization_id: organization.id,
        };

        return {
          profile,
          organization,
          membership,
          settings: (settingsData as OrganizationSettings | null) ?? null,
          availableOrganizations: [{ organization, membership }],
          supportSession,
        };
      }

      // A platform operator only enters a tenant through an explicit,
      // expiring support session. Never fall back to a customer membership.
      return null;
    }

    let selected = memberships.find(
      (membership) =>
        membership.organization_id === baseProfile.active_organization_id
    );
    if (!selected) selected = memberships[0];

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
  if (!tenant) {
    if (await isCurrentUserPlatformAdmin()) {
      redirect("/platform?aviso=sessao-expirada");
    }
    redirect("/login?erro=organizacao");
  }
  if (
    !tenant.supportSession &&
    (tenant.organization.status === "suspended" ||
      tenant.organization.status === "cancelled")
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
  const [{ data: claimsData, error: claimsError }, { data: auth, error: userError }] =
    await Promise.all([supabase.auth.getClaims(), supabase.auth.getUser()]);
  if (claimsError || userError) return { currentLevel: null, nextLevel: null };
  const aal = claimsData?.claims.aal;
  const currentLevel = aal === "aal1" || aal === "aal2" ? aal : null;
  const hasVerifiedFactor = auth.user?.factors?.some(
    (factor) => factor.status === "verified"
  );
  return {
    currentLevel,
    nextLevel: hasVerifiedFactor ? ("aal2" as const) : currentLevel,
  };
}

export async function requirePlatformAdmin(options: { requireMfa?: boolean } = {}) {
  if (!(await isCurrentUserPlatformAdmin())) redirect("/");
  if (options.requireMfa) {
    const assurance = await getPlatformMfaStatus();
    if (assurance.currentLevel !== "aal2") redirect("/seguranca/mfa");
  }
}
