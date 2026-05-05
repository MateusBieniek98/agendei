// Route handler de login — alternativa ao Server Action.
// Em route handlers, o suporte a Set-Cookie em redirect é nativo
// e completamente confiável em qualquer plataforma de deploy.

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ROLE_HOME, type UserRole } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim();
  const senha = String(form.get("senha") ?? "");
  const from = String(form.get("from") ?? "");

  if (!email || !senha) {
    return NextResponse.redirect(
      new URL(`/login?erro=campos`, req.url),
      { status: 303 }
    );
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error || !data.user) {
    return NextResponse.redirect(
      new URL(`/login?erro=credenciais`, req.url),
      { status: 303 }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile?.role) {
    return NextResponse.redirect(
      new URL("/login?erro=perfil", req.url),
      { status: 303 }
    );
  }

  const role = profile.role as UserRole;
  const target = from && from !== "/login" ? from : ROLE_HOME[role];

  return NextResponse.redirect(new URL(target, req.url), { status: 303 });
}
