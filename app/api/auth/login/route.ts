// Route handler de login — alternativa ao Server Action.
// Em route handlers, o suporte a Set-Cookie em redirect é nativo
// e completamente confiável em qualquer plataforma de deploy.

import { NextResponse, type NextRequest } from "next/server";
import { createClient, type Session } from "@supabase/supabase-js";
import { defaultRouteForRole, safeReturnPath } from "@/lib/navigation";
import type { UserRole } from "@/lib/types";

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

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim();
  const senha = String(form.get("senha") ?? "");
  const from = String(form.get("from") ?? "");
  const returnPath = safeReturnPath(from);

  function errorRedirect(code: "campos" | "credenciais" | "perfil") {
    const url = new URL("/login", req.url);
    url.searchParams.set("erro", code);
    if (returnPath) url.searchParams.set("from", returnPath);
    return NextResponse.redirect(url, { status: 303 });
  }

  if (!email || !senha) {
    return errorRedirect("campos");
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
    return errorRedirect("credenciais");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile?.role) {
    return errorRedirect("perfil");
  }

  const role = profile.role as UserRole;
  const target = returnPath ?? defaultRouteForRole(role);
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
