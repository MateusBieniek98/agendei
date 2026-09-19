// Reset de senha — só admin chamando, via service_role.
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentTenantContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const tenant = await getCurrentTenantContext();
  if (!tenant || tenant.membership.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor." },
      { status: 500 }
    );
  }

  const { id } = await ctx.params;
  const { senha } = await req.json().catch(() => ({}));
  if (!senha || String(senha).length < 8) {
    return NextResponse.json(
      { error: "senha precisa ter pelo menos 8 caracteres" },
      { status: 400 }
    );
  }

  const { data: membership } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", tenant.organization.id)
    .eq("user_id", id)
    .eq("active", true)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Usuário não pertence a esta empresa." }, { status: 404 });
  }

  const { count: activeOrganizations } = await admin
    .from("organization_members")
    .select("organization_id", { count: "exact", head: true })
    .eq("user_id", id)
    .eq("active", true);
  if ((activeOrganizations ?? 0) > 1) {
    return NextResponse.json(
      { error: "Este usuário acessa mais de uma empresa e deve redefinir a própria senha." },
      { status: 409 }
    );
  }

  const { error } = await admin.auth.admin.updateUserById(id, {
    password: String(senha),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await admin.from("platform_audit_log").insert({
    actor_id: tenant.profile.id,
    organization_id: tenant.organization.id,
    action: "organization.member_password_reset",
    details: { target_user_id: id },
  });
  return NextResponse.json({ ok: true });
}
