import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { defaultRouteForRole, safeReturnPath } from "@/lib/navigation";
import { resolveLoginAccess } from "@/lib/tenant-transition";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PendingCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

function escapeHtmlAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function sessionCommitPage(target: string) {
  const targetForScript = JSON.stringify(target).replaceAll("<", "\\u003c");
  const targetForMeta = escapeHtmlAttribute(target);

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="refresh" content="0;url=${targetForMeta}">
    <title>Talhivo</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f3f5f2; color: #34413b; font: 600 14px system-ui, sans-serif; }
      span { width: 22px; height: 22px; border: 2px solid #cfd8d2; border-top-color: #235f46; border-radius: 50%; animation: spin .7s linear infinite; }
      main { display: grid; justify-items: center; gap: 12px; }
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  </head>
  <body>
    <main><span aria-hidden="true"></span><div>Concluindo acesso...</div></main>
    <script>window.location.replace(${targetForScript});</script>
  </body>
</html>`;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim();
  const senha = String(form.get("senha") ?? "");
  const from = String(form.get("from") ?? "");
  const returnPath = safeReturnPath(from);

  function errorRedirect(code: "campos" | "credenciais" | "perfil" | "organizacao") {
    const url = new URL("/login", req.url);
    url.searchParams.set("erro", code);
    if (returnPath) url.searchParams.set("from", returnPath);
    return NextResponse.redirect(url, { status: 303 });
  }

  if (!email || !senha) {
    return errorRedirect("campos");
  }

  const pendingCookies: PendingCookie[] = [];
  const pendingHeaders = new Map<string, string>();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          pendingCookies.push(...cookiesToSet);
          Object.entries(headers).forEach(([name, value]) =>
            pendingHeaders.set(name, value)
          );
        },
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

  const access = await resolveLoginAccess(supabase, data.user.id);
  if (!access.ok) return errorRedirect(access.reason);

  const target = access.platformAdmin
    ? "/platform"
    : returnPath ?? defaultRouteForRole(access.role);
  const targetUrl = new URL(target, req.url);
  const targetPath = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
  const response = new NextResponse(sessionCommitPage(targetPath), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy":
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'",
      "referrer-policy": "no-referrer",
      "x-robots-tag": "noindex, nofollow",
    },
  });

  pendingCookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options)
  );
  pendingHeaders.forEach((value, name) => response.headers.set(name, value));

  return response;
}
