// Endpoint de diagnóstico — abre /api/whoami no navegador depois do login.
// Mostra se o servidor está vendo o cookie de sessão e quem é o usuário.
//
// Em produção, ajuda a debugar problemas de auth: se user=null aqui, a
// sessão não está sendo lida (cookie ausente / domínio errado / RLS).

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();

  // lista nomes dos cookies presentes (sem expor valores)
  const cookieStore = await cookies();
  const cookieNames = cookieStore.getAll().map((c) => c.name);
  const sbCookies = cookieNames.filter((n) => n.startsWith("sb-"));

  const tenant = data.user ? await getCurrentTenantContext() : null;

  return NextResponse.json({
    authenticated: !!data.user,
    user_id: data.user?.id ?? null,
    user_email: data.user?.email ?? null,
    profile: tenant?.profile ?? null,
    organization: tenant
      ? {
          id: tenant.organization.id,
          display_name: tenant.organization.display_name,
          status: tenant.organization.status,
          role: tenant.membership.role,
        }
      : null,
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
