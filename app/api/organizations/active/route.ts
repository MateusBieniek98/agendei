import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { defaultRouteForRole } from "@/lib/navigation";
import type { UserRole } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const organizationId = String(body.organization_id ?? "");
  if (!organizationId) return NextResponse.json({ error: "Empresa obrigatória." }, { status: 400 });

  const { error } = await supabase.rpc("switch_active_organization", {
    p_organization_id: organizationId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", auth.user.id)
    .eq("active", true)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Associação não encontrada." }, { status: 404 });

  return NextResponse.json({
    ok: true,
    home: defaultRouteForRole(membership.role as UserRole),
  });
}
