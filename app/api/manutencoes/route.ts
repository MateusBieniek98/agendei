import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import {
  buildMaintenanceThreads,
  parseMentionIds,
  sanitizeMentionIds,
  uploadMaintenancePhotos,
  validateMaintenancePhotos,
} from "@/lib/maintenance-social";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MACHINE_STATUSES = ["operando", "parada", "manutencao_urgente"] as const;

type MachineStatusInput = (typeof MACHINE_STATUSES)[number];

function isMachineStatus(value: unknown): value is MachineStatusInput {
  return typeof value === "string" && MACHINE_STATUSES.includes(value as never);
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function collectFormPhotos(form: FormData) {
  return [...form.getAll("photos"), ...form.getAll("photos[]")].filter(
    (item): item is File => item instanceof File && item.size > 0
  );
}

async function insertMentions({
  supabase,
  manutencaoId,
  mentionedBy,
  mentionIds,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>;
  manutencaoId: string;
  mentionedBy: string;
  mentionIds: string[];
}) {
  const ids = await sanitizeMentionIds(supabase, mentionIds, mentionedBy);
  if (ids.length === 0) return null;

  const { error } = await supabase.from("manutencao_mencoes").insert(
    ids.map((id) => ({
      manutencao_id: manutencaoId,
      mentioned_profile_id: id,
      mentioned_by: mentionedBy,
    }))
  );

  return error;
}

async function createMaintenance({
  req,
  isMultipart,
}: {
  req: NextRequest;
  isMultipart: boolean;
}) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (profile.role === "manutencao") {
    return NextResponse.json({ error: "a manutenção recebe solicitações, mas não abre chamados" }, { status: 403 });
  }

  const form = isMultipart ? await req.formData() : null;
  const body = form ? null : await req.json().catch(() => ({}));

  const maquina_id = text(form?.get("maquina_id") ?? body?.maquina_id);
  const equipe_id = text(form?.get("equipe_id") ?? body?.equipe_id);
  const projeto_id = text(form?.get("projeto_id") ?? body?.projeto_id);
  const talhao = text(form?.get("talhao") ?? body?.talhao);
  const descricao = text(form?.get("descricao") ?? body?.descricao);
  const status_maquina = form?.get("status_maquina") ?? body?.status_maquina;
  const mentionIds = parseMentionIds(
    form
      ? [form.get("mention_ids"), form.getAll("mention_ids[]")].flat()
      : body?.mention_ids
  );
  const photos = form ? collectFormPhotos(form) : [];

  if (!maquina_id || !equipe_id || !projeto_id || !talhao || !descricao) {
    return NextResponse.json({ error: "campos obrigatórios" }, { status: 400 });
  }

  if (status_maquina && !isMachineStatus(status_maquina)) {
    return NextResponse.json({ error: "status de máquina inválido" }, { status: 400 });
  }

  const photoError = validateMaintenancePhotos(photos);
  if (photoError) return NextResponse.json({ error: photoError }, { status: 400 });

  const novoStatusMaquina = (status_maquina ?? "manutencao_urgente") as MachineStatusInput;
  const supabase = await createSupabaseServer();
  const { data: existing } = await supabase
    .from("manutencoes")
    .select("id")
    .eq("maquina_id", maquina_id)
    .neq("status", "resolvido")
    .limit(1)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "Esta máquina já possui uma solicitação aguardando manutenção." },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("manutencoes")
    .insert({
      maquina_id,
      equipe_id,
      projeto_id,
      talhao,
      descricao,
      reportado_por: profile.id,
    })
    .select()
    .single();

  if (error) {
    const message = error.code === "23505"
      ? "Esta máquina já possui uma solicitação aguardando manutenção."
      : error.message;
    return NextResponse.json({ error: message }, { status: error.code === "23505" ? 409 : 400 });
  }

  const mentionError = await insertMentions({
    supabase,
    manutencaoId: data.id,
    mentionedBy: profile.id,
    mentionIds,
  });
  if (mentionError) {
    return NextResponse.json({ error: mentionError.message }, { status: 400 });
  }

  const photoErrors =
    photos.length > 0
      ? await uploadMaintenancePhotos({
          supabase,
          profile,
          manutencaoId: data.id,
          files: photos,
        })
      : [];

  const { error: statusError } = await supabase.rpc("set_machine_status", {
    p_maquina_id: maquina_id,
    p_status: novoStatusMaquina,
  });

  if (statusError) {
    return NextResponse.json({ error: statusError.message }, { status: 400 });
  }

  return NextResponse.json(
    {
      item: data,
      photo_errors: photoErrors,
    },
    { status: 201 }
  );
}

export async function GET(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const pendentes = sp.get("pendentes");
  const mine = sp.get("mine");
  const mentioned = sp.get("mentioned");
  const supabase = await createSupabaseServer();

  let mentionedIds: string[] | null = null;
  if (mentioned === "1" || mentioned === "true") {
    const { data, error } = await supabase
      .from("manutencao_mencoes")
      .select("manutencao_id")
      .eq("mentioned_profile_id", profile.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    mentionedIds = Array.from(new Set((data ?? []).map((item) => item.manutencao_id)));
    if (mentionedIds.length === 0) return NextResponse.json({ items: [] });
  }

  let q = supabase
    .from("manutencoes")
    .select(
      "*, maquinas(nome, tipo, identificador, status), equipes(nome), projetos(nome), autor:profiles!manutencoes_reportado_por_fkey(id,nome,role,equipe_id), responsavel:profiles!manutencoes_responsavel_id_fkey(id,nome,role,equipe_id), concluido_por_profile:profiles!manutencoes_concluido_por_fkey(id,nome,role,equipe_id)"
    )
    .order("prioridade", { ascending: false })
    .order("created_at", { ascending: true });

  if (status) q = q.eq("status", status);
  if (pendentes === "1" || pendentes === "true") q = q.neq("status", "resolvido");
  if (mine === "1" || mine === "true") q = q.eq("reportado_por", profile.id);
  if (mentionedIds) q = q.in("id", mentionedIds);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  try {
    const items = await buildMaintenanceThreads(supabase, (data ?? []) as never, profile);
    return NextResponse.json({
      items,
      current_user: {
        id: profile.id,
        role: profile.role,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  return createMaintenance({
    req,
    isMultipart: contentType.includes("multipart/form-data"),
  });
}
