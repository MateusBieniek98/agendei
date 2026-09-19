// Proxy minimalista — só refresca tokens do Supabase para que server
// components sempre vejam uma sessão válida. NÃO faz redirect: os
// próprios layouts protegidos (admin, gestor, field) chamam
// `requireRole(...)` que redireciona quando necessário. Manter o redirect
// aqui criava risco de loops em transições logo após o login.

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  MAINTENANCE_BYPASS_HEADER,
  maintenanceBypassAllowed,
  maintenanceModeEnabled,
  maintenancePathIsPublic,
} from "@/lib/maintenance-mode";

function forwardedRequestHeaders(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete(MAINTENANCE_BYPASS_HEADER);
  const cookies = request.cookies.toString();
  if (cookies) headers.set("cookie", cookies);
  return headers;
}

export async function proxy(request: NextRequest) {
  let requestHeaders = forwardedRequestHeaders(request);
  const bypassAllowed = maintenanceBypassAllowed(
    request.headers.get(MAINTENANCE_BYPASS_HEADER),
  );

  if (maintenanceModeEnabled()) {
    if (maintenancePathIsPublic(request.nextUrl.pathname)) {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }

    if (!bypassAllowed) {
      if (request.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json(
          {
            error: "Sistema temporariamente em manutenção.",
            code: "maintenance_mode",
          },
          {
            status: 503,
            headers: { "cache-control": "no-store", "retry-after": "300" },
          },
        );
      }

      const maintenanceUrl = request.nextUrl.clone();
      maintenanceUrl.pathname = "/manutencao-sistema";
      maintenanceUrl.search = "";
      const maintenanceResponse = NextResponse.redirect(maintenanceUrl, 307);
      maintenanceResponse.headers.set("cache-control", "no-store");
      maintenanceResponse.headers.set("retry-after", "300");
      return maintenanceResponse;
    }
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } });

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
          requestHeaders = forwardedRequestHeaders(request);
          response = NextResponse.next({ request: { headers: requestHeaders } });
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
