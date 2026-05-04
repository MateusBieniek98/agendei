import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("metas")
    .select("*")
    .order("ano", { ascending: false })
    .order("mes", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data });
}

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json();
  const supabase = await createSupabaseServer();
  // upsert por (ano, mes)
  const { data, error } = await supabase
    .from("metas")
    .upsert(body, { onConflict: "ano,mes" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ item: data });
}
