import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set<EmailOtpType>([
  "email",
  "invite",
  "magiclink",
  "recovery",
  "signup",
  "email_change",
]);

export async function GET(req: NextRequest) {
  const tokenHash = req.nextUrl.searchParams.get("token_hash") ?? "";
  const type = req.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const nextParam = req.nextUrl.searchParams.get("next") ?? "/api/auth/complete";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//")
    ? nextParam
    : "/api/auth/complete";

  if (!tokenHash || !type || !ALLOWED_TYPES.has(type)) {
    return NextResponse.redirect(new URL("/login?erro=credenciais", req.url), { status: 303 });
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    return NextResponse.redirect(new URL("/login?erro=credenciais", req.url), { status: 303 });
  }

  return NextResponse.redirect(new URL(next, req.url), { status: 303 });
}
