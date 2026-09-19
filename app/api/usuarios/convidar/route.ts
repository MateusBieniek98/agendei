import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentTenantContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types";
import { consumeOrganizationRateLimit } from "@/lib/rate-limit";
import { logEvent } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ROLES: UserRole[] = ["encarregado", "admin", "gestor", "manutencao"];

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

export async function POST(req: NextRequest) {
  const tenant = await getCurrentTenantContext();
  if (!tenant) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (tenant.membership.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const rateLimit = await consumeOrganizationRateLimit({ organizationId: tenant.organization.id, bucket: "users.invite", limit: 20, windowSeconds: 3600 });
  if (!rateLimit.allowed) return NextResponse.json({ error: "Limite de convites por hora atingido." }, { status: 429 });

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Configuração do servidor indisponível." }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const nome = String(body.nome ?? "").trim();
  const role = String(body.role ?? "") as UserRole;
  const equipeId = body.equipe_id ? String(body.equipe_id) : null;
  if (!email || !nome || !ROLES.includes(role) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Informe nome, e-mail e perfil válidos." }, { status: 400 });
  }

  if (equipeId) {
    const { data: team } = await admin
      .from("equipes")
      .select("id")
      .eq("organization_id", tenant.organization.id)
      .eq("id", equipeId)
      .maybeSingle();
    if (!team) return NextResponse.json({ error: "Equipe não pertence a esta empresa." }, { status: 400 });
  }

  const { count } = await admin
    .from("organization_members")
    .select("user_id", { count: "exact", head: true })
    .eq("organization_id", tenant.organization.id)
    .eq("active", true);
  if ((count ?? 0) >= tenant.organization.user_limit) {
    return NextResponse.json(
      { error: `Limite de ${tenant.organization.user_limit} usuários ativos atingido.` },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  await admin
    .from("organization_invitations")
    .update({ revoked_at: now })
    .eq("organization_id", tenant.organization.id)
    .eq("email", email)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .lte("expires_at", now);

  const { data: pending } = await admin
    .from("organization_invitations")
    .select("id")
    .eq("organization_id", tenant.organization.id)
    .eq("email", email)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", now)
    .maybeSingle();
  if (pending) {
    return NextResponse.json({ error: "Já existe um convite válido para este e-mail." }, { status: 409 });
  }

  const tokenHash = createHash("sha256").update(randomBytes(32)).digest("hex");
  const { data: invitation, error: invitationError } = await admin
    .from("organization_invitations")
    .insert({
      organization_id: tenant.organization.id,
      email,
      role,
      equipe_id: equipeId,
      token_hash: tokenHash,
      invited_by: tenant.profile.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();
  if (invitationError || !invitation) {
    return NextResponse.json({ error: invitationError?.message ?? "Falha ao criar convite." }, { status: 400 });
  }

  const redirectTo = new URL("/api/auth/complete", req.nextUrl.origin).toString();
  const existingUser = await findAuthUserByEmail(admin, email);
  let sendError: Error | null = null;
  if (existingUser) {
    const { error: metadataError } = await admin.auth.admin.updateUserById(existingUser.id, {
      user_metadata: {
        ...(existingUser.user_metadata ?? {}),
        nome,
        pending_invitation_id: invitation.id,
      },
    });
    if (metadataError) {
      sendError = metadataError;
    } else {
      const { error } = await admin.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
      });
      sendError = error;
    }
  } else {
    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { nome, pending_invitation_id: invitation.id },
    });
    sendError = error;
  }

  if (sendError) {
    await admin
      .from("organization_invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", invitation.id);
    return NextResponse.json({ error: `Convite não enviado: ${sendError.message}` }, { status: 502 });
  }

  await admin.from("platform_audit_log").insert({
    actor_id: tenant.profile.id,
    organization_id: tenant.organization.id,
    action: "organization.user_invited",
    details: { invitation_id: invitation.id, email, role, equipe_id: equipeId },
  });
  logEvent("info", "organization.user_invited", {
    actorId: tenant.profile.id,
    organizationId: tenant.organization.id,
    invitationId: invitation.id,
    role,
  });

  return NextResponse.json(
    { ok: true, message: "Convite enviado; o link expira em 7 dias." },
    { status: 201 }
  );
}
