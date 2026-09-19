import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { defaultRouteForRole } from "@/lib/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveLoginAccess } from "@/lib/tenant-transition";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  }

  const pendingInvitationId = String(
    (auth.user.user_metadata as Record<string, unknown> | undefined)
      ?.pending_invitation_id ?? ""
  );
  if (pendingInvitationId) {
    const admin = createSupabaseAdminClient();
    const userEmail = auth.user.email?.trim().toLowerCase();
    if (admin && userEmail) {
      const { data: invitation } = await admin
        .from("organization_invitations")
        .select("id,organization_id,email,role,equipe_id,invited_by,expires_at,accepted_at,revoked_at")
        .eq("id", pendingInvitationId)
        .eq("email", userEmail)
        .maybeSingle();
      if (
        invitation &&
        !invitation.accepted_at &&
        !invitation.revoked_at &&
        new Date(invitation.expires_at).getTime() > Date.now()
      ) {
        const nome = String(
          (auth.user.user_metadata as Record<string, unknown> | undefined)?.nome ??
            userEmail.split("@")[0]
        ).trim();
        await admin.from("profiles").upsert(
          {
            id: auth.user.id,
            email: userEmail,
            nome,
            role: invitation.role,
            equipe_id: invitation.equipe_id,
            active_organization_id: invitation.organization_id,
            ativo: true,
          },
          { onConflict: "id" }
        );
        await admin.from("organization_members").upsert(
          {
            organization_id: invitation.organization_id,
            user_id: auth.user.id,
            role: invitation.role,
            equipe_id: invitation.equipe_id,
            active: true,
            invited_by: invitation.invited_by,
            joined_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,user_id" }
        );
        await admin
          .from("organization_invitations")
          .update({ accepted_at: new Date().toISOString() })
          .eq("id", invitation.id);
        await admin.auth.admin.updateUserById(auth.user.id, {
          user_metadata: { nome, pending_invitation_id: null },
        });
      }
    }
  }

  const access = await resolveLoginAccess(supabase, auth.user.id);
  if (!access.ok) {
    return NextResponse.redirect(new URL(`/login?erro=${access.reason}`, req.url), {
      status: 303,
    });
  }

  const from = req.nextUrl.searchParams.get("from");
  const target =
    from && from !== "/login" && from !== "/catalogo"
      ? from
      : defaultRouteForRole(access.role);

  return NextResponse.redirect(new URL(target, req.url), { status: 303 });
}
