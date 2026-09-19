import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) {
    return NextResponse.json(
      { error: "Origem inválida para encerrar a sessão." },
      { status: 403 },
    );
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) {
    return NextResponse.json(
      { error: "Não foi possível encerrar a sessão. Tente novamente." },
      { status: 502 },
    );
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function GET() {
  return NextResponse.json(
    { error: "Use POST para encerrar a sessão." },
    { status: 405, headers: { allow: "POST", "cache-control": "no-store" } },
  );
}
