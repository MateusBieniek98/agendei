import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getPlatformMfaStatus, isCurrentUserPlatformAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import { logEvent } from "@/lib/logger";

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

async function platformContext() {
  if (!(await isCurrentUserPlatformAdmin())) {
    return { response: NextResponse.json({ error: "forbidden" }, { status: 403 }) } as const;
  }
  const assurance = await getPlatformMfaStatus();
  if (assurance.currentLevel !== "aal2") {
    return {
      response: NextResponse.json(
        { error: "mfa_required", next: "/seguranca/mfa" },
        { status: 403 }
      ),
    } as const;
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      response: NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor." },
        { status: 500 }
      ),
    } as const;
  }
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { response: NextResponse.json({ error: "unauthenticated" }, { status: 401 }) } as const;
  }
  return { admin, user: auth.user } as const;
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
  const context = await platformContext();
  if ("response" in context) return context.response;

  const [{ data: organizations, error }, { data: members }] = await Promise.all([
    context.admin.from("organizations").select("*").order("created_at", { ascending: false }),
    context.admin.from("organization_members").select("organization_id,active"),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const activeCounts = new Map<string, number>();
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
    })),
  });
}

export async function POST(req: NextRequest) {
  const context = await platformContext();
  if ("response" in context) return context.response;

  const body = await req.json().catch(() => ({}));
  const displayName = String(body.display_name ?? "").trim();
  const legalName = String(body.legal_name ?? "").trim() || null;
  const slug = normalizeSlug(body.slug || displayName);
  const billingEmail = String(body.billing_email ?? "").trim().toLowerCase() || null;
  const adminEmail = String(body.admin_email ?? "").trim().toLowerCase() || null;
  const adminName = String(body.admin_name ?? "").trim() || "Administrador";
  const userLimit = Math.min(Math.max(Number(body.user_limit ?? 30), 1), 10000);

  if (!displayName || !slug) {
    return NextResponse.json({ error: "Nome e identificador da empresa são obrigatórios." }, { status: 400 });
  }

  const { data: organization, error } = await context.admin
    .from("organizations")
    .insert({
      slug,
      display_name: displayName,
      legal_name: legalName,
      billing_email: billingEmail,
      status: body.status === "active" ? "active" : "onboarding",
      plan_code: String(body.plan_code ?? "founder"),
      user_limit: userLimit,
      contract_started_at: body.contract_started_at || null,
      created_by: context.user.id,
    })
    .select("*")
    .single();
  if (error || !organization) {
    return NextResponse.json({ error: error?.message ?? "Falha ao criar empresa." }, { status: 400 });
  }

  const { error: settingsError } = await context.admin.from("organization_settings").insert({
    organization_id: organization.id,
    operational_name: displayName,
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
  const context = await platformContext();
  if ("response" in context) return context.response;

  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  const allowedStatuses = new Set(["onboarding", "active", "suspended", "cancelled"]);
  if (!id) return NextResponse.json({ error: "Empresa obrigatória." }, { status: 400 });

  const patch: Record<string, unknown> = {};
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
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nenhuma alteração informada." }, { status: 400 });
  }

  const { data, error } = await context.admin
    .from("organizations")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });

  await context.admin.from("platform_audit_log").insert({
    actor_id: context.user.id,
    organization_id: id,
    action: "organization.updated",
    details: patch,
  });
  logEvent("info", "organization.updated", {
    actorId: context.user.id,
    organizationId: id,
    status: typeof patch.status === "string" ? patch.status : undefined,
  });
  return NextResponse.json({ item: data });
}
