// Endpoint de diagnóstico — abre /api/whoami no navegador depois do login.
// Mostra se o servidor está vendo o cookie de sessão e quem é o usuário.
//
// Em produção, ajuda a debugar problemas de auth: se user=null aqui, a
// sessão não está sendo lida (cookie ausente / domínio errado / RLS).

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();

  // lista nomes dos cookies presentes (sem expor valores)
  const cookieStore = await cookies();
  const cookieNames = cookieStore.getAll().map((c) => c.name);
  const sbCookies = cookieNames.filter((n) => n.startsWith("sb-"));

  let profile = null;
  if (data.user) {
    const { data: p } = await supabase
      .from("profiles")
      .select("id, email, nome, role")
      .eq("id", data.user.id)
      .maybeSingle();
    profile = p;
  }

  return NextResponse.json({
    authenticated: !!data.user,
    user_id: data.user?.id ?? null,
    user_email: data.user?.email ?? null,
    profile,
    auth_error: error?.message ?? null,
    cookies_total: cookieNames.length,
    cookies_supabase: sbCookies,
    env_check: {
      url_set: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      anon_set: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      url_host: process.env.NEXT_PUBLIC_SUPABASE_URL
        ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
        : null,
    },
  });
}
