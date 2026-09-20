import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { consumeOrganizationRateLimit } from "@/lib/rate-limit";
import { logEvent } from "@/lib/logger";
import { encryptIntegrationSecret } from "@/lib/integration-secrets";
import { validateWebhookUrl } from "@/lib/google-sheets-apontamentos";
import { getPlatformApiContext } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const platform = await getPlatformApiContext();
  if ("response" in platform) return platform.response;

  const { id } = await context.params;
  const { data: organization } = await platform.admin
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
  const { data: existingIntegration } = await platform.admin
    .from("organization_integrations")
    .select("config")
    .eq("organization_id", id)
    .eq("provider", "google_sheets")
    .maybeSingle();
  const existingConfig = (existingIntegration?.config ?? {}) as Record<string, unknown>;
  const { error } = await platform.admin.from("organization_integrations").upsert(
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

  await platform.admin.from("platform_audit_log").insert({
    actor_id: platform.user.id,
    organization_id: id,
    action: "organization.integration_token_rotated",
    details: { provider: "google_sheets" },
  });
  logEvent("info", "organization.integration_token_rotated", {
    actorId: platform.user.id,
    organizationId: id,
    provider: "google_sheets",
  });

  return NextResponse.json({
    token,
    provider: "google_sheets",
    warning: "Copie agora. Por segurança, este token não será exibido novamente.",
  });
}
