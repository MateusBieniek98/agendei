import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantContext } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ROLES: UserRole[] = ["encarregado", "admin", "gestor", "manutencao"];

export async function POST(req: NextRequest) {
  const tenant = await getCurrentTenantContext();
  if (!tenant) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (tenant.membership.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor." },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const senha = String(body.senha ?? "");
  const nome = String(body.nome ?? "").trim();
  const role = String(body.role ?? "") as UserRole;
  const equipeId = body.equipe_id ? String(body.equipe_id) : null;

  if (!email || !senha || !nome || !ROLES.includes(role)) {
    return NextResponse.json(
      { error: "Informe nome, e-mail, senha e um perfil válido." },
      { status: 400 }
    );
  }
  if (senha.length < 8) {
    return NextResponse.json(
      { error: "A senha inicial precisa ter pelo menos 8 caracteres." },
      { status: 400 }
    );
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

  if (equipeId) {
    const { data: team } = await admin
      .from("equipes")
      .select("id")
      .eq("id", equipeId)
      .eq("organization_id", tenant.organization.id)
      .maybeSingle();
    if (!team) {
      return NextResponse.json({ error: "Equipe não pertence a esta empresa." }, { status: 400 });
    }
  }

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  });
  if (authError || !created.user) {
    const message = authError?.message ?? "Falha ao criar usuário.";
    const duplicate = message.toLowerCase().includes("already") || message.toLowerCase().includes("registered");
    return NextResponse.json(
      {
        error: duplicate
          ? "Este e-mail já possui uma conta. Use o fluxo de convite para associá-lo à empresa."
          : message,
      },
      { status: duplicate ? 409 : 400 }
    );
  }

  const userId = created.user.id;
  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: userId,
      email,
      nome,
      role,
      equipe_id: equipeId,
      active_organization_id: tenant.organization.id,
      ativo: true,
    },
    { onConflict: "id" }
  );
  if (profileError) {
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  const { error: membershipError } = await admin.from("organization_members").insert({
    organization_id: tenant.organization.id,
    user_id: userId,
    role,
    equipe_id: equipeId,
    active: true,
    invited_by: tenant.profile.id,
  });
  if (membershipError) {
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    return NextResponse.json({ error: membershipError.message }, { status: 400 });
  }

  await admin.from("platform_audit_log").insert({
    actor_id: tenant.profile.id,
    organization_id: tenant.organization.id,
    action: "organization.user_created_assisted",
    details: { target_user_id: userId, email, role, equipe_id: equipeId },
  });

  return NextResponse.json(
    {
      item: {
        id: userId,
        email,
        nome,
        role,
        equipe_id: equipeId,
        active_organization_id: tenant.organization.id,
        ativo: true,
      },
    },
    { status: 201 }
  );
}
