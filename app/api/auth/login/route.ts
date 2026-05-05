// Route handler de login — alternativa ao Server Action.
// Em route handlers, o suporte a Set-Cookie em redirect é nativo
// e completamente confiável em qualquer plataforma de deploy.

import { NextResponse, type NextRequest } from "next/server";
import { createClient, type Session } from "@supabase/supabase-js";
import { ROLE_HOME, type UserRole } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function supabaseAuthCookieName() {
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname;
  const ref = host.split(".")[0];
  return `sb-${ref}-auth-token`;
}

function encodeSupabaseSession(session: Session) {
  return `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
}

function roleFromEmail(email: string): UserRole | null {
  if (email === "admin@gn.local") return "admin";
  if (email === "gestor@gn.local") return "gestor";
  if (email === "encarregado@gn.local") return "encarregado";
  return null;
}

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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    }
  );

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error || !data.user || !data.session) {
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

  const role =
    (profile?.role as UserRole | undefined) ?? roleFromEmail(data.user.email ?? "");

  if (!role) {
    return NextResponse.redirect(new URL("/login?erro=perfil", req.url), {
      status: 303,
    });
  }

  const target = from && from !== "/login" ? from : ROLE_HOME[role];
  const response = NextResponse.redirect(new URL(target, req.url), {
    status: 303,
  });

  response.cookies.set({
    name: supabaseAuthCookieName(),
    value: encodeSupabaseSession(data.session),
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
  });

  return response;
}
