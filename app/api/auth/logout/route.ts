import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function supabaseAuthCookieName() {
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname;
  const ref = host.split(".")[0];
  return `sb-${ref}-auth-token`;
}

export async function GET(req: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", req.url), {
    status: 303,
  });

  response.cookies.set({
    name: supabaseAuthCookieName(),
    value: "",
    path: "/",
    maxAge: 0,
  });

  return response;
}
