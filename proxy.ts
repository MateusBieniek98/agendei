// Proxy minimalista — só refresca tokens do Supabase para que server
// components sempre vejam uma sessão válida. NÃO faz redirect: os
// próprios layouts protegidos (admin, gestor, field) chamam
// `requireRole(...)` que redireciona quando necessário. Manter o redirect
// aqui criava risco de loops em transições logo após o login.

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Apenas refresca a sessão (efeito colateral via callbacks acima).
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|api/health).*)",
  ],
};
