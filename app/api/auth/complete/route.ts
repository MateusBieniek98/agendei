import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ROLE_HOME, type UserRole } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile?.role) {
    return NextResponse.redirect(new URL("/login?erro=perfil", req.url), {
      status: 303,
    });
  }

  const from = req.nextUrl.searchParams.get("from");
  const role = profile.role as UserRole;
  const target = from && from !== "/login" ? from : ROLE_HOME[role];

  return NextResponse.redirect(new URL(target, req.url), { status: 303 });
}
