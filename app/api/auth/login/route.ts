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

  const target = returnPath ?? defaultRouteForRole(access.role);
  const response = NextResponse.redirect(new URL(target, req.url), {
    status: 303,
  });

  pendingCookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options)
  );
  pendingHeaders.forEach((value, name) => response.headers.set(name, value));

  return response;
}
