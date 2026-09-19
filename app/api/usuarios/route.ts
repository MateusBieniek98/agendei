import { NextResponse, type NextRequest } from "next/server";
import { getCurrentTenantContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ROLES: UserRole[] = ["encarregado", "admin", "gestor", "manutencao"];

async function requireOrganizationAdmin() {
  const tenant = await getCurrentTenantContext();
  if (!tenant) {
    return { response: NextResponse.json({ error: "unauthenticated" }, { status: 401 }) } as const;
  }
  if (tenant.membership.role !== "admin") {
    return { response: NextResponse.json({ error: "forbidden" }, { status: 403 }) } as const;
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
  return { tenant, admin } as const;
}

export async function GET() {
  const auth = await requireOrganizationAdmin();
  if ("response" in auth) return auth.response;

  const { data: memberships, error } = await auth.admin
    .from("organization_members")
    .select("user_id,role,equipe_id,active,joined_at,created_at,updated_at")
    .eq("organization_id", auth.tenant.organization.id)
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const userIds = (memberships ?? []).map((item) => String(item.user_id));
  if (userIds.length === 0) return NextResponse.json({ items: [] });

  const [{ data: profiles }, { data: teams }] = await Promise.all([
    auth.admin.from("profiles").select("id,email,nome,created_at,updated_at").in("id", userIds),
    auth.admin
      .from("equipes")
      .select("id,nome")
      .eq("organization_id", auth.tenant.organization.id),
  ]);
  const profilesById = new Map((profiles ?? []).map((profile) => [String(profile.id), profile]));
  const teamsById = new Map((teams ?? []).map((team) => [String(team.id), team]));

  const items = (memberships ?? []).map((membership) => {
    const profile = profilesById.get(String(membership.user_id));
    const team = membership.equipe_id
      ? teamsById.get(String(membership.equipe_id)) ?? null
      : null;
    return {
      id: String(membership.user_id),
      email: String(profile?.email ?? ""),
      nome: String(profile?.nome ?? "Usuário"),
      role: membership.role as UserRole,
      equipe_id: membership.equipe_id ? String(membership.equipe_id) : null,
      active_organization_id: auth.tenant.organization.id,
      ativo: membership.active !== false,
      created_at: String(profile?.created_at ?? membership.created_at),
      updated_at: String(profile?.updated_at ?? membership.updated_at),
      equipes: team ? { nome: String(team.nome) } : null,
      profile_missing: !profile,
      auth_missing: false,
      last_sign_in_at: null,
      email_confirmed_at: null,
    };
  });
  items.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return NextResponse.json({ items, source: "organization_members" });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireOrganizationAdmin();
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  if (body.role !== undefined && !ROLES.includes(body.role as UserRole)) {
    return NextResponse.json({ error: "Perfil inválido." }, { status: 400 });
  }

  const { data: membership } = await auth.admin
    .from("organization_members")
    .select("user_id,role,active")
    .eq("organization_id", auth.tenant.organization.id)
    .eq("user_id", id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Usuário não pertence a esta empresa." }, { status: 404 });

  if (id === auth.tenant.profile.id && body.ativo === false) {
    return NextResponse.json({ error: "Você não pode desativar o próprio acesso." }, { status: 400 });
  }
  const removesAdminAccess =
    membership.active !== false &&
    membership.role === "admin" &&
    (body.ativo === false || (body.role !== undefined && body.role !== "admin"));
  if (removesAdminAccess) {
    const { count: otherAdmins } = await auth.admin
      .from("organization_members")
      .select("user_id", { count: "exact", head: true })
      .eq("organization_id", auth.tenant.organization.id)
      .eq("role", "admin")
      .eq("active", true)
      .neq("user_id", id);
    if ((otherAdmins ?? 0) === 0) {
      return NextResponse.json(
        { error: "A empresa precisa manter pelo menos um administrador ativo." },
        { status: 409 }
      );
    }
  }

  const equipeId = body.equipe_id === undefined ? undefined : body.equipe_id || null;
  if (equipeId) {
    const { data: team } = await auth.admin
      .from("equipes")
      .select("id")
      .eq("organization_id", auth.tenant.organization.id)
      .eq("id", equipeId)
      .maybeSingle();
    if (!team) return NextResponse.json({ error: "Equipe não pertence a esta empresa." }, { status: 400 });
  }

  const memberPatch: Record<string, unknown> = {};
  if (body.role !== undefined) memberPatch.role = body.role;
  if (equipeId !== undefined) memberPatch.equipe_id = equipeId;
  if (body.ativo !== undefined) memberPatch.active = Boolean(body.ativo);
  if (Object.keys(memberPatch).length > 0) {
    const { error } = await auth.admin
      .from("organization_members")
      .update(memberPatch)
      .eq("organization_id", auth.tenant.organization.id)
      .eq("user_id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (body.nome !== undefined) {
    const nome = String(body.nome).trim();
    if (!nome) return NextResponse.json({ error: "Nome obrigatório." }, { status: 400 });
    const { error } = await auth.admin.from("profiles").update({ nome }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await auth.admin.auth.admin.updateUserById(id, { user_metadata: { nome } }).catch(() => undefined);
  }

  await auth.admin.from("platform_audit_log").insert({
    actor_id: auth.tenant.profile.id,
    organization_id: auth.tenant.organization.id,
    action: "organization.member_updated",
    details: {
      target_user_id: id,
      membership: memberPatch,
      name_changed: body.nome !== undefined,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireOrganizationAdmin();
  if ("response" in auth) return auth.response;

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  if (id === auth.tenant.profile.id) {
    return NextResponse.json({ error: "Você não pode remover o próprio acesso." }, { status: 400 });
  }

  const { data: targetMembership } = await auth.admin
    .from("organization_members")
    .select("role,active")
    .eq("organization_id", auth.tenant.organization.id)
    .eq("user_id", id)
    .maybeSingle();
  if (!targetMembership) {
    return NextResponse.json({ error: "Usuário não pertence a esta empresa." }, { status: 404 });
  }
  if (targetMembership.role === "admin" && targetMembership.active !== false) {
    const { count: otherAdmins } = await auth.admin
      .from("organization_members")
      .select("user_id", { count: "exact", head: true })
      .eq("organization_id", auth.tenant.organization.id)
      .eq("role", "admin")
      .eq("active", true)
      .neq("user_id", id);
    if ((otherAdmins ?? 0) === 0) {
      return NextResponse.json(
        { error: "A empresa precisa manter pelo menos um administrador ativo." },
        { status: 409 }
      );
    }
  }

  const { data, error } = await auth.admin
    .from("organization_members")
    .update({ active: false, equipe_id: null })
    .eq("organization_id", auth.tenant.organization.id)
    .eq("user_id", id)
    .select("user_id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Usuário não pertence a esta empresa." }, { status: 404 });

  const { count } = await auth.admin
    .from("organization_members")
    .select("organization_id", { count: "exact", head: true })
    .eq("user_id", id)
    .eq("active", true);
  if ((count ?? 0) === 0) await auth.admin.from("profiles").update({ ativo: false }).eq("id", id);

  await auth.admin.from("platform_audit_log").insert({
    actor_id: auth.tenant.profile.id,
    organization_id: auth.tenant.organization.id,
    action: "organization.member_deactivated",
    details: { target_user_id: id },
  });

  return NextResponse.json({
    ok: true,
    mode: "deactivated",
    message: "Acesso removido desta empresa; o histórico foi preservado.",
  });
}
