import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

const MACHINE_STATUSES = ["operando", "parada", "manutencao_urgente"] as const;

function isMachineStatus(value: unknown): value is (typeof MACHINE_STATUSES)[number] {
  return typeof value === "string" && MACHINE_STATUSES.includes(value as never);
}

export async function GET(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const pendentes = sp.get("pendentes");
  const supabase = await createSupabaseServer();
  let q = supabase
    .from("manutencoes")
    .select(
      "*, maquinas(nome, tipo, identificador, status), equipes(nome), projetos(nome)"
    )
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  if (pendentes === "1" || pendentes === "true") q = q.neq("status", "resolvido");
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data });
}

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await req.json();
  const { maquina_id, equipe_id, projeto_id, talhao, descricao, status_maquina } = body;
  if (!maquina_id || !equipe_id || !projeto_id || !talhao || !descricao) {
    return NextResponse.json({ error: "campos obrigatórios" }, { status: 400 });
  }
  if (status_maquina && !isMachineStatus(status_maquina)) {
    return NextResponse.json({ error: "status de máquina inválido" }, { status: 400 });
  }
  const novoStatusMaquina = (status_maquina ?? "manutencao_urgente") as
    | "operando"
    | "parada"
    | "manutencao_urgente";

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("manutencoes")
    .insert({
      maquina_id,
      equipe_id,
      projeto_id,
      talhao: String(talhao).trim(),
      descricao,
      reportado_por: profile.id,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { error: statusError } = await supabase.rpc("set_machine_status", {
    p_maquina_id: maquina_id,
    p_status: novoStatusMaquina,
  });
  if (statusError) {
    return NextResponse.json({ error: statusError.message }, { status: 400 });
  }

  return NextResponse.json({ item: data }, { status: 201 });
}
