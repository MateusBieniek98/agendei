import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/logger";
import { getPlatformApiContext } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeSlug(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function optionalText(value: unknown, maxLength = 255) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function optionalEmail(value: unknown) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

async function findAuthUserByEmail(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  email: string
) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < 1000) break;
  }
  return null;
}

export async function GET() {
  const context = await getPlatformApiContext();
  if ("response" in context) return context.response;

  const [
    { data: organizations, error },
    { data: members },
    { data: settings },
    { data: integrations },
  ] = await Promise.all([
    context.admin.from("organizations").select("*").order("created_at", { ascending: false }),
    context.admin.from("organization_members").select("organization_id,active"),
    context.admin.from("organization_settings").select("*"),
    context.admin
      .from("organization_integrations")
      .select("organization_id,provider,enabled,config,last_success_at,last_error")
      .eq("provider", "google_sheets"),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const activeCounts = new Map<string, number>();
  const settingsByOrganization = new Map(
    (settings ?? []).map((item) => [String(item.organization_id), item])
  );
  const integrationByOrganization = new Map(
    (integrations ?? []).map((item) => [
      String(item.organization_id),
      {
        provider: item.provider,
        enabled: item.enabled,
        webhook_url:
          typeof item.config === "object" &&
          item.config !== null &&
          "apontamentos_webhook_url" in item.config
            ? String(item.config.apontamentos_webhook_url ?? "")
            : "",
        last_success_at: item.last_success_at,
        last_error: item.last_error,
      },
    ])
  );
  for (const member of members ?? []) {
    if (member.active !== false) {
      const id = String(member.organization_id);
      activeCounts.set(id, (activeCounts.get(id) ?? 0) + 1);
    }
  }
  return NextResponse.json({
    items: (organizations ?? []).map((organization) => ({
      ...organization,
      active_users: activeCounts.get(String(organization.id)) ?? 0,
      settings: settingsByOrganization.get(String(organization.id)) ?? null,
      integration: integrationByOrganization.get(String(organization.id)) ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const context = await getPlatformApiContext();
  if ("response" in context) return context.response;

  const body = await req.json().catch(() => ({}));
  const displayName = String(body.display_name ?? "").trim();
  const legalName = String(body.legal_name ?? "").trim() || null;
  const documentNumber = optionalText(body.document_number, 40);
  const slug = normalizeSlug(body.slug || displayName);
  const billingEmail = String(body.billing_email ?? "").trim().toLowerCase() || null;
  const adminEmail = optionalEmail(body.admin_email);
  const adminName = optionalText(body.admin_name, 120) ?? "Administrador";
  const userLimit = Math.min(Math.max(Number(body.user_limit ?? 30), 1), 10000);
  const supportEmail = optionalEmail(body.support_email);
  const privacyEmail = optionalEmail(body.privacy_email);

  if (!displayName || !slug) {
    return NextResponse.json({ error: "Nome e identificador da empresa são obrigatórios." }, { status: 400 });
  }
  if (billingEmail && optionalEmail(billingEmail) === undefined) {
    return NextResponse.json({ error: "E-mail de cobrança inválido." }, { status: 400 });
  }
  if (adminEmail === undefined) {
    return NextResponse.json({ error: "E-mail do administrador inválido." }, { status: 400 });
  }
  if (supportEmail === undefined || privacyEmail === undefined) {
    return NextResponse.json({ error: "E-mail de suporte ou privacidade inválido." }, { status: 400 });
  }
  if (!Number.isInteger(userLimit)) {
    return NextResponse.json({ error: "Limite de usuários inválido." }, { status: 400 });
  }

  const { data: organization, error } = await context.admin
    .from("organizations")
    .insert({
      slug,
      display_name: displayName,
      legal_name: legalName,
      document_number: documentNumber,
      billing_email: billingEmail,
      status: body.status === "active" ? "active" : "onboarding",
      plan_code: String(body.plan_code ?? "founder"),
      user_limit: userLimit,
      contract_started_at: body.contract_started_at || null,
      contract_ends_at: body.contract_ends_at || null,
      created_by: context.user.id,
    })
    .select("*")
    .single();
  if (error || !organization) {
    return NextResponse.json({ error: error?.message ?? "Falha ao criar empresa." }, { status: 400 });
  }

  const { error: settingsError } = await context.admin.from("organization_settings").insert({
    organization_id: organization.id,
    operational_name: optionalText(body.operational_name) ?? displayName,
    support_email: supportEmail,
    privacy_email: privacyEmail,
    timezone: optionalText(body.timezone, 80) ?? "America/Campo_Grande",
    locale: optionalText(body.locale, 20) ?? "pt-BR",
  });
  if (settingsError) {
    await context.admin.from("organizations").delete().eq("id", organization.id);
    return NextResponse.json({ error: settingsError.message }, { status: 400 });
  }

  let onboarding: { mode: string; message: string } | null = null;
  if (adminEmail) {
    try {
      const existingUser = await findAuthUserByEmail(context.admin, adminEmail);
      if (existingUser) {
        await context.admin.from("profiles").upsert(
          {
            id: existingUser.id,
            email: adminEmail,
            nome: adminName,
            role: "admin",
            ativo: true,
          },
          { onConflict: "id" }
        );
        await context.admin.from("organization_members").upsert(
          {
            organization_id: organization.id,
            user_id: existingUser.id,
            role: "admin",
            active: true,
            invited_by: context.user.id,
          },
          { onConflict: "organization_id,user_id" }
        );
        await context.admin
          .from("profiles")
          .update({ active_organization_id: organization.id })
          .eq("id", existingUser.id)
          .is("active_organization_id", null);
        onboarding = { mode: "membership", message: "Administrador existente associado." };
      } else {
        const tokenHash = createHash("sha256")
          .update(randomBytes(32))
          .digest("hex");
        const { data: invitation, error: invitationError } = await context.admin
          .from("organization_invitations")
          .insert({
            organization_id: organization.id,
            email: adminEmail,
            role: "admin",
            token_hash: tokenHash,
            invited_by: context.user.id,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .select("id")
          .single();
        if (invitationError || !invitation) throw invitationError ?? new Error("Falha ao criar convite.");

        const redirectTo = new URL("/api/auth/complete", req.nextUrl.origin).toString();
        const { error: inviteError } = await context.admin.auth.admin.inviteUserByEmail(
          adminEmail,
          {
            redirectTo,
            data: { nome: adminName, pending_invitation_id: invitation.id },
          }
        );
        if (inviteError) {
          await context.admin
            .from("organization_invitations")
            .update({ revoked_at: new Date().toISOString() })
            .eq("id", invitation.id);
          onboarding = { mode: "warning", message: `Empresa criada, mas o convite falhou: ${inviteError.message}` };
        } else {
          onboarding = { mode: "invitation", message: "Convite do primeiro administrador enviado." };
        }
      }
    } catch (inviteError) {
      onboarding = {
        mode: "warning",
        message: `Empresa criada, mas o administrador não foi provisionado: ${(inviteError as Error).message}`,
      };
    }
  }

  await context.admin.from("platform_audit_log").insert({
    actor_id: context.user.id,
    organization_id: organization.id,
    action: "organization.created",
    details: { slug, display_name: displayName, plan_code: organization.plan_code },
  });
  logEvent("info", "organization.created", {
    actorId: context.user.id,
    organizationId: organization.id,
    slug,
  });

  return NextResponse.json({ item: organization, onboarding }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const context = await getPlatformApiContext();
  if ("response" in context) return context.response;

  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  const allowedStatuses = new Set(["onboarding", "active", "suspended", "cancelled"]);
  if (!id) return NextResponse.json({ error: "Empresa obrigatória." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  const settingsPatch: Record<string, unknown> = {};
  if (body.display_name !== undefined) {
    const displayName = optionalText(body.display_name, 120);
    if (!displayName) {
      return NextResponse.json({ error: "Nome operacional obrigatório." }, { status: 400 });
    }
    patch.display_name = displayName;
  }
  for (const field of ["legal_name", "document_number"] as const) {
    if (body[field] !== undefined) patch[field] = optionalText(body[field]);
  }
  if (body.billing_email !== undefined) {
    const email = optionalEmail(body.billing_email);
    if (email === undefined) {
      return NextResponse.json({ error: "E-mail de cobrança inválido." }, { status: 400 });
    }
    patch.billing_email = email;
  }
  if (body.status !== undefined) {
    if (!allowedStatuses.has(String(body.status))) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }
    patch.status = String(body.status);
    patch.suspended_reason = body.status === "suspended"
      ? String(body.suspended_reason ?? "Suspensão comercial manual").trim()
      : null;
  }
  if (body.plan_code !== undefined) patch.plan_code = String(body.plan_code).trim() || "founder";
  if (body.user_limit !== undefined) {
    const userLimit = Number(body.user_limit);
    if (!Number.isInteger(userLimit) || userLimit < 1 || userLimit > 10000) {
      return NextResponse.json({ error: "Limite de usuários inválido." }, { status: 400 });
    }
    const { count } = await context.admin
      .from("organization_members")
      .select("user_id", { count: "exact", head: true })
      .eq("organization_id", id)
      .eq("active", true);
    if ((count ?? 0) > userLimit) {
      return NextResponse.json({ error: "O limite não pode ser menor que os usuários ativos." }, { status: 409 });
    }
    patch.user_limit = userLimit;
  }
  for (const field of ["contract_started_at", "contract_ends_at"] as const) {
    if (body[field] !== undefined) patch[field] = body[field] || null;
  }
  for (const field of ["operational_name", "timezone", "locale"] as const) {
    if (body[field] !== undefined) settingsPatch[field] = optionalText(body[field]);
  }
  for (const field of ["support_email", "privacy_email"] as const) {
    if (body[field] === undefined) continue;
    const email = optionalEmail(body[field]);
    if (email === undefined) {
      return NextResponse.json({ error: `E-mail inválido em ${field}.` }, { status: 400 });
    }
    settingsPatch[field] = email;
  }
  if (Object.keys(patch).length === 0 && Object.keys(settingsPatch).length === 0) {
    return NextResponse.json({ error: "Nenhuma alteração informada." }, { status: 400 });
  }

  const { data: current } = await context.admin
    .from("organizations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!current) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });

  let data = current;
  if (Object.keys(patch).length > 0) {
    const updated = await context.admin
      .from("organizations")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (updated.error) {
      return NextResponse.json({ error: updated.error.message }, { status: 400 });
    }
    if (updated.data) data = updated.data;
  }

  let settings = null;
  if (Object.keys(settingsPatch).length > 0) {
    const updatedSettings = await context.admin
      .from("organization_settings")
      .upsert({ organization_id: id, ...settingsPatch }, { onConflict: "organization_id" })
      .select("*")
      .single();
    if (updatedSettings.error) {
      if (Object.keys(patch).length > 0) {
        const rollback = Object.fromEntries(
          Object.keys(patch).map((field) => [
            field,
            current[field as keyof typeof current],
          ])
        );
        await context.admin.from("organizations").update(rollback).eq("id", id);
      }
      return NextResponse.json({ error: updatedSettings.error.message }, { status: 400 });
    }
    settings = updatedSettings.data;
  } else {
    const currentSettings = await context.admin
      .from("organization_settings")
      .select("*")
      .eq("organization_id", id)
      .maybeSingle();
    settings = currentSettings.data;
  }

  await context.admin.from("platform_audit_log").insert({
    actor_id: context.user.id,
    organization_id: id,
    action: "organization.updated",
    details: { organization: patch, settings: settingsPatch },
  });
  logEvent("info", "organization.updated", {
    actorId: context.user.id,
    organizationId: id,
    status: typeof patch.status === "string" ? patch.status : undefined,
  });
  return NextResponse.json({ item: { ...data, settings } });
}
