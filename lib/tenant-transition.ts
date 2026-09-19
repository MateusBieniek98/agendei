import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Organization,
  OrganizationMembership,
  Profile,
  TenantContext,
  UserRole,
} from "@/lib/types";

const LEGACY_ORGANIZATION_ID = "00000000-0000-0000-0000-000000000001";
const USER_ROLES: UserRole[] = ["encarregado", "admin", "gestor", "manutencao"];
const TENANT_SCHEMA_MARKERS = [
  "active_organization_id",
  "organization_members",
  "organizations",
  "organization_settings",
];
const MISSING_SCHEMA_CODES = new Set(["42P01", "42703", "PGRST204", "PGRST205"]);

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

type LoginAccess =
  | { ok: true; role: UserRole; legacy: boolean }
  | { ok: false; reason: "perfil" | "organizacao" };

function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole);
}

export function legacySingleTenantEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.NODE_ENV === "development" && env.ALLOW_LEGACY_SINGLE_TENANT === "true";
}

export function isTenantSchemaUnavailable(error: SupabaseErrorLike | null | undefined) {
  if (!error?.code || !MISSING_SCHEMA_CODES.has(error.code)) return false;
  const description = [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return TENANT_SCHEMA_MARKERS.some((marker) => description.includes(marker));
}

async function resolveLegacyLoginAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<LoginAccess> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, ativo")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile?.ativo || !isUserRole(profile.role)) {
    return { ok: false, reason: "perfil" };
  }

  return { ok: true, role: profile.role, legacy: true };
}

export async function resolveLoginAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<LoginAccess> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("active_organization_id, ativo")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    if (
      legacySingleTenantEnabled() &&
      isTenantSchemaUnavailable(profileError)
    ) {
      return resolveLegacyLoginAccess(supabase, userId);
    }
    return { ok: false, reason: "perfil" };
  }

  if (!profile?.ativo || !profile.active_organization_id) {
    return { ok: false, reason: "perfil" };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("role, active, organizations:organizations(status)")
    .eq("organization_id", profile.active_organization_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError) {
    if (
      legacySingleTenantEnabled() &&
      isTenantSchemaUnavailable(membershipError)
    ) {
      return resolveLegacyLoginAccess(supabase, userId);
    }
    return { ok: false, reason: "organizacao" };
  }

  const organization = membership?.organizations as unknown as {
    status?: string;
  } | null;
  if (!membership?.active || !organization || !isUserRole(membership.role)) {
    return { ok: false, reason: "organizacao" };
  }

  return { ok: true, role: membership.role, legacy: false };
}

export function createLegacyTenantContext(profile: Profile): TenantContext {
  const timestamp = profile.created_at || new Date(0).toISOString();
  const organization: Organization = {
    id: LEGACY_ORGANIZATION_ID,
    slug: "gn-silvicultura",
    display_name: process.env.LEGACY_SINGLE_TENANT_NAME?.trim() || "GN Silvicultura",
    legal_name: null,
    document_number: null,
    status: "active",
    plan_code: "legacy",
    user_limit: 0,
    billing_email: null,
    contract_started_at: null,
    contract_ends_at: null,
    suspended_reason: null,
    created_at: timestamp,
    updated_at: profile.updated_at || timestamp,
  };
  const membership: OrganizationMembership = {
    organization_id: organization.id,
    user_id: profile.id,
    role: profile.role,
    equipe_id: profile.equipe_id,
    active: true,
    invited_by: null,
    joined_at: timestamp,
    created_at: timestamp,
    updated_at: profile.updated_at || timestamp,
  };
  const legacyProfile: Profile = {
    ...profile,
    active_organization_id: organization.id,
  };

  return {
    profile: legacyProfile,
    organization,
    membership,
    settings: null,
    availableOrganizations: [{ organization, membership }],
  };
}
