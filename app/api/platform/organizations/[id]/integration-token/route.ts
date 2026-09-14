import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getPlatformMfaStatus, isCurrentUserPlatformAdmin } from "@/lib/auth";
import { consumeOrganizationRateLimit } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import { logEvent } from "@/lib/logger";
import { encryptIntegrationSecret } from "@/lib/integration-secrets";
import { validateWebhookUrl } from "@/lib/google-sheets-apontamentos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  if (!(await isCurrentUserPlatformAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const assurance = await getPlatformMfaStatus();
  if (assurance.currentLevel !== "aal2") {
    return NextResponse.json(
      { error: "mfa_required", next: "/seguranca/mfa" },
      { status: 403 }
    );
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor." },
      { status: 500 }
    );
  }
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await context.params;
  const { data: organization } = await admin
    .from("organizations")
    .select("id,display_name")
    .eq("id", id)
    .maybeSingle();
  if (!organization) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }
  const body = await request.json().catch(() => ({}));
  const webhookUrl = String(body.apontamentos_webhook_url ?? "").trim();
  if (webhookUrl) {
    const webhookError = validateWebhookUrl(webhookUrl);
    if (webhookError) return NextResponse.json({ error: webhookError }, { status: 400 });
  }
  const rateLimit = await consumeOrganizationRateLimit({
    organizationId: id,
    bucket: "platform.integration-token.rotate",
    limit: 10,
    windowSeconds: 3600,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Limite de rotações por hora atingido." }, { status: 429 });
  }

  // The plaintext exists only in this response. The database stores SHA-256.
  const token = `fst_${randomBytes(32).toString("base64url")}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  let encryptedToken: string;
  try {
    encryptedToken = encryptIntegrationSecret(token);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
  const { data: existingIntegration } = await admin
    .from("organization_integrations")
    .select("config")
    .eq("organization_id", id)
    .eq("provider", "google_sheets")
    .maybeSingle();
  const existingConfig = (existingIntegration?.config ?? {}) as Record<string, unknown>;
  const { error } = await admin.from("organization_integrations").upsert(
    {
      organization_id: id,
      provider: "google_sheets",
      enabled: true,
      token_hash: tokenHash,
      secret_reference: null,
      config: {
        ...existingConfig,
        encrypted_sync_token: encryptedToken,
        ...(webhookUrl ? { apontamentos_webhook_url: webhookUrl } : {}),
      },
      last_error: null,
    },
    { onConflict: "organization_id,provider" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await admin.from("platform_audit_log").insert({
    actor_id: auth.user.id,
    organization_id: id,
    action: "organization.integration_token_rotated",
    details: { provider: "google_sheets" },
  });
  logEvent("info", "organization.integration_token_rotated", {
    actorId: auth.user.id,
    organizationId: id,
    provider: "google_sheets",
  });

  return NextResponse.json({
    token,
    provider: "google_sheets",
    warning: "Copie agora. Por segurança, este token não será exibido novamente.",
  });
}
