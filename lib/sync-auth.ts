import type { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const SYNC_TOKEN_ENV_NAMES = ["SHARED_SYNC_TOKEN", "GOOGLE_SHEETS_SYNC_TOKEN"] as const;

function bearer(req: NextRequest) {
  const header = req.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

export function requestedSyncToken(req: NextRequest) {
  return bearer(req) || req.nextUrl.searchParams.get("token")?.trim() || "";
}

export function configuredSyncTokens() {
  return SYNC_TOKEN_ENV_NAMES.map((name) => process.env[name]?.trim()).filter(
    (value): value is string => Boolean(value)
  );
}

export function primarySyncToken() {
  return configuredSyncTokens()[0] ?? "";
}

export function isAuthorizedSyncRequest(req: NextRequest) {
  const token = requestedSyncToken(req);
  if (!token) return false;
  return configuredSyncTokens().includes(token);
}

export type SyncOrganization = { id: string; slug: string };

/**
 * Resolves the tenant from a per-organization integration token. Environment
 * tokens remain a temporary bridge for the first customer's legacy integration.
 */
export async function resolveSyncOrganization(
  req: NextRequest
): Promise<SyncOrganization | null> {
  const token = requestedSyncToken(req);
  if (!token) return null;

  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data: integration } = await admin
    .from("organization_integrations")
    .select("organization_id,organizations:organizations(id,slug,status)")
    .eq("provider", "google_sheets")
    .eq("enabled", true)
    .eq("token_hash", tokenHash)
    .maybeSingle();
  const integrationOrg = integration?.organizations as unknown as
    | { id: string; slug: string; status: string }
    | null;
  if (integrationOrg && ["onboarding", "active"].includes(integrationOrg.status)) {
    return { id: integrationOrg.id, slug: integrationOrg.slug };
  }

  if (!configuredSyncTokens().includes(token)) return null;
  const legacySlug = process.env.LEGACY_SYNC_ORGANIZATION_SLUG?.trim() || "gn";
  const { data: legacyOrganization } = await admin
    .from("organizations")
    .select("id,slug,status")
    .eq("slug", legacySlug)
    .in("status", ["onboarding", "active"])
    .maybeSingle();
  return legacyOrganization
    ? { id: String(legacyOrganization.id), slug: String(legacyOrganization.slug) }
    : null;
}

export function isAuthorizedCronRequest(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return false;
  return req.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export function syncTokenMissingMessage() {
  return "Token de sincronizacao nao configurado no servidor. Configure SHARED_SYNC_TOKEN ou GOOGLE_SHEETS_SYNC_TOKEN no Vercel.";
}
