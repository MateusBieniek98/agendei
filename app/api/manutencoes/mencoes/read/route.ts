import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const manutencaoId = typeof body.manutencao_id === "string" ? body.manutencao_id : "";
  const mentionIds = Array.isArray(body.mention_ids)
    ? body.mention_ids.filter((id: unknown): id is string => typeof id === "string")
    : [];

  const supabase = await createSupabaseServer();
  let query = supabase
    .from("manutencao_mencoes")
    .update({ read_at: new Date().toISOString() })
    .eq("mentioned_profile_id", profile.id)
    .is("read_at", null);

  if (manutencaoId) query = query.eq("manutencao_id", manutencaoId);
  if (mentionIds.length > 0) query = query.in("id", mentionIds);

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
