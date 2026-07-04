import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  MachineStatus,
  Manutencao,
  ManutencaoAnexo,
  ManutencaoComentario,
  ManutencaoMencao,
  ManutencaoThread,
  MentionableProfile,
  Profile,
} from "@/lib/types";

export const MAINTENANCE_PHOTO_BUCKET = "manutencao-fotos";
export const MAINTENANCE_MAX_PHOTOS = 3;
export const MAINTENANCE_MAX_PHOTO_BYTES = 6 * 1024 * 1024;
export const MAINTENANCE_PHOTO_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type DbClient = SupabaseClient;

type MaintenanceRow = Manutencao & {
  maquinas: {
    nome: string;
    tipo: string;
    identificador: string | null;
    status: MachineStatus;
  } | null;
  equipes: { nome: string } | null;
  projetos: { nome: string } | null;
  autor: MentionableProfile | null;
};

type CommentRow = ManutencaoComentario & {
  autor: MentionableProfile | null;
};

type MentionRow = ManutencaoMencao & {
  mentioned: MentionableProfile | null;
};

function isMissingSocialTable(error: unknown) {
  const maybeError = error as { code?: string; message?: string } | null;
  const message = maybeError?.message?.toLowerCase() ?? "";
  return (
    maybeError?.code === "42P01" ||
    message.includes("does not exist") ||
    message.includes("could not find the table")
  );
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function parseMentionIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return uniqueStrings(value.flatMap((item) => parseMentionIds(item)));
  }

  if (typeof value !== "string") return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return uniqueStrings(parsed.map(String));
  } catch {
    // Fall back to comma-separated ids.
  }

  return uniqueStrings(trimmed.split(","));
}

export function validateMaintenancePhotos(files: File[]) {
  if (files.length > MAINTENANCE_MAX_PHOTOS) {
    return `Envie no máximo ${MAINTENANCE_MAX_PHOTOS} fotos por pedido.`;
  }

  for (const file of files) {
    if (!MAINTENANCE_PHOTO_MIMES.has(file.type)) {
      return "Use apenas imagens JPG, PNG ou WebP.";
    }
    if (file.size > MAINTENANCE_MAX_PHOTO_BYTES) {
      return "Cada foto deve ter até 6MB.";
    }
  }

  return null;
}

function safeFileName(name: string) {
  const fallback = "foto";
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || fallback;
}

export async function sanitizeMentionIds(
  supabase: DbClient,
  ids: string[],
  actorId: string
) {
  const unique = uniqueStrings(ids).filter((id) => id !== actorId);
  if (unique.length === 0) return [];

  const admin = createSupabaseAdminClient();
  const client = admin ?? supabase;
  const { data, error } = await client
    .from("profiles")
    .select("id")
    .in("id", unique)
    .eq("ativo", true);

  if (error) return [];
  const allowed = new Set((data ?? []).map((profile) => String(profile.id)));
  return unique.filter((id) => allowed.has(id));
}

export async function uploadMaintenancePhotos({
  supabase,
  profile,
  manutencaoId,
  files,
}: {
  supabase: DbClient;
  profile: Profile;
  manutencaoId: string;
  files: File[];
}) {
  const rows: Omit<ManutencaoAnexo, "id" | "created_at" | "url">[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const storagePath = `${profile.id}/${manutencaoId}/${randomUUID()}-${safeFileName(
      file.name
    )}`;
    const { error } = await supabase.storage
      .from(MAINTENANCE_PHOTO_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      errors.push(`${file.name}: ${error.message}`);
      continue;
    }

    rows.push({
      manutencao_id: manutencaoId,
      storage_path: storagePath,
      file_name: file.name || "foto",
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: profile.id,
    });
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("manutencao_anexos").insert(rows);
    if (error) errors.push(error.message);
  }

  return errors;
}

export async function canCommentOnMaintenance(
  supabase: DbClient,
  manutencaoId: string,
  profile: Profile
) {
  if (profile.role === "admin" || profile.role === "gestor") return true;

  const { data: manut } = await supabase
    .from("manutencoes")
    .select("reportado_por")
    .eq("id", manutencaoId)
    .maybeSingle();

  if (manut?.reportado_por === profile.id) return true;

  const [{ data: mention }, { data: comment }] = await Promise.all([
    supabase
      .from("manutencao_mencoes")
      .select("id")
      .eq("manutencao_id", manutencaoId)
      .eq("mentioned_profile_id", profile.id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("manutencao_comentarios")
      .select("id")
      .eq("manutencao_id", manutencaoId)
      .eq("autor_id", profile.id)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle(),
  ]);

  return Boolean(mention || comment);
}

async function signAttachmentUrls(supabase: DbClient, anexos: ManutencaoAnexo[]) {
  return Promise.all(
    anexos.map(async (anexo) => {
      const { data } = await supabase.storage
        .from(MAINTENANCE_PHOTO_BUCKET)
        .createSignedUrl(anexo.storage_path, 30 * 60);
      return { ...anexo, url: data?.signedUrl ?? null };
    })
  );
}

export async function buildMaintenanceThreads(
  supabase: DbClient,
  rows: MaintenanceRow[],
  profile: Profile
): Promise<ManutencaoThread[]> {
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return [];

  const [
    { data: anexosRaw, error: anexosError },
    { data: commentsRaw, error: commentsError },
    { data: mentionsRaw, error: mentionsError },
  ] = await Promise.all([
    supabase
      .from("manutencao_anexos")
      .select("*")
      .in("manutencao_id", ids)
      .order("created_at", { ascending: true }),
    supabase
      .from("manutencao_comentarios")
      .select(
        "*, autor:profiles!manutencao_comentarios_autor_id_fkey(id,nome,role,equipe_id)"
      )
      .in("manutencao_id", ids)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    supabase
      .from("manutencao_mencoes")
      .select(
        "*, mentioned:profiles!manutencao_mencoes_mentioned_profile_id_fkey(id,nome,role,equipe_id)"
      )
      .in("manutencao_id", ids)
      .order("created_at", { ascending: true }),
  ]);

  if (anexosError && !isMissingSocialTable(anexosError)) throw anexosError;
  if (commentsError && !isMissingSocialTable(commentsError)) throw commentsError;
  if (mentionsError && !isMissingSocialTable(mentionsError)) throw mentionsError;

  const anexos = (anexosError ? [] : anexosRaw ?? []) as ManutencaoAnexo[];
  const comments = (commentsError ? [] : commentsRaw ?? []) as CommentRow[];
  const mentions = (mentionsError ? [] : mentionsRaw ?? []) as MentionRow[];

  const anexosByManut = new Map<string, ManutencaoAnexo[]>();
  for (const anexo of anexos) {
    const current = anexosByManut.get(anexo.manutencao_id) ?? [];
    current.push(anexo);
    anexosByManut.set(anexo.manutencao_id, current);
  }

  const commentsByManut = new Map<string, CommentRow[]>();
  for (const comment of comments) {
    const current = commentsByManut.get(comment.manutencao_id) ?? [];
    current.push(comment);
    commentsByManut.set(comment.manutencao_id, current);
  }

  const mentionsByManut = new Map<string, MentionRow[]>();
  const mentionsByComment = new Map<string, MentionRow[]>();
  for (const mention of mentions) {
    const byManut = mentionsByManut.get(mention.manutencao_id) ?? [];
    byManut.push(mention);
    mentionsByManut.set(mention.manutencao_id, byManut);

    if (mention.comentario_id) {
      const byComment = mentionsByComment.get(mention.comentario_id) ?? [];
      byComment.push(mention);
      mentionsByComment.set(mention.comentario_id, byComment);
    }
  }

  return Promise.all(
    rows.map(async (row) => {
      const rowAnexos = await signAttachmentUrls(
        supabase,
        anexosByManut.get(row.id) ?? []
      );
      const rowComments = commentsByManut.get(row.id) ?? [];
      const rowMentions = mentionsByManut.get(row.id) ?? [];
      const mentionedProfileIds = uniqueStrings(
        rowMentions.map((mention) => mention.mentioned_profile_id)
      );
      const hasCommented = rowComments.some((comment) => comment.autor_id === profile.id);
      const isMentioned = mentionedProfileIds.includes(profile.id);
      const isAuthor = row.reportado_por === profile.id;
      const isManager = profile.role === "admin" || profile.role === "gestor";

      return {
        ...row,
        anexos: rowAnexos,
        comentarios: rowComments.map((comment) => ({
          ...comment,
          mencoes: mentionsByComment.get(comment.id) ?? [],
        })),
        comentarios_count: rowComments.length,
        unread_mentions_count: rowMentions.filter(
          (mention) => mention.mentioned_profile_id === profile.id && !mention.read_at
        ).length,
        mentioned_profile_ids: mentionedProfileIds,
        can_comment: isManager || isAuthor || isMentioned || hasCommented,
        can_resolve:
          row.status !== "resolvido" &&
          (profile.role === "admin" || profile.role === "encarregado"),
        can_manage_status: profile.role === "admin",
      };
    })
  );
}
