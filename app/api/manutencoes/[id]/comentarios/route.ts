import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  canCommentOnMaintenance,
  parseMentionIds,
  sanitizeMentionIds,
} from "@/lib/maintenance-social";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const texto = String(body.texto ?? "").trim();
  const mentionIds = parseMentionIds(body.mention_ids);

  if (!texto) return NextResponse.json({ error: "comentário obrigatório" }, { status: 400 });
  if (texto.length > 2000) {
    return NextResponse.json({ error: "comentário muito longo" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const allowed = await canCommentOnMaintenance(supabase, id, profile);
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("manutencao_comentarios")
    .insert({
      manutencao_id: id,
      autor_id: profile.id,
      texto,
    })
    .select(
      "*, autor:profiles!manutencao_comentarios_autor_id_fkey(id,nome,role,equipe_id)"
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const sanitizedMentions = await sanitizeMentionIds(supabase, mentionIds, profile.id);
  if (sanitizedMentions.length > 0) {
    const { error: mentionError } = await supabase.from("manutencao_mencoes").insert(
      sanitizedMentions.map((mentionedId) => ({
        manutencao_id: id,
        comentario_id: data.id,
        mentioned_profile_id: mentionedId,
        mentioned_by: profile.id,
      }))
    );

    if (mentionError) {
      return NextResponse.json({ error: mentionError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ item: data }, { status: 201 });
}
