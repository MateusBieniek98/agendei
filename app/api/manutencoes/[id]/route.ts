import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import type { MachineStatus, MaintenancePriority } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const profile = await getCurrentProfile();
  if (!profile)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  if (!["admin", "manutencao"].includes(profile.role))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? body.acao ?? "").trim();
  const actions = ["assumir", "atribuir", "iniciar", "priorizar", "concluir", "atualizar_situacao"];
  const priorities: MaintenancePriority[] = ["normal", "alta", "urgente"];
  const machineStatuses: MachineStatus[] = ["operando", "parada", "manutencao_urgente"];

  if (!actions.includes(action)) {
    return NextResponse.json({ error: "ação de manutenção inválida" }, { status: 400 });
  }
  if (action === "atribuir" && !String(body.responsavel_id ?? "").trim()) {
    return NextResponse.json({ error: "responsável obrigatório" }, { status: 400 });
  }
  if (action === "priorizar" && !priorities.includes(body.prioridade)) {
    return NextResponse.json({ error: "prioridade inválida" }, { status: 400 });
  }
  if (
    action === "concluir" &&
    (String(body.relato_conclusao ?? "").trim().length < 3 ||
      !machineStatuses.includes(body.status_maquina))
  ) {
    return NextResponse.json(
      { error: "informe o serviço realizado e o status final da máquina" },
      { status: 400 }
    );
  }
  if (
    action === "atualizar_situacao" &&
    (String(body.situacao_atual ?? "").trim().length < 3 ||
      String(body.situacao_atual ?? "").trim().length > 500)
  ) {
    return NextResponse.json(
      { error: "informe a situação atual com 3 a 500 caracteres" },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServer();
  if (action === "atualizar_situacao") {
    const { data, error } = await supabase.rpc("update_maintenance_situation", {
      p_manutencao_id: id,
      p_situacao: String(body.situacao_atual).trim(),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ item: data });
  }

  const { data, error } = await supabase.rpc("maintenance_action", {
    p_manutencao_id: id,
    p_action: action,
    p_responsavel_id: action === "atribuir" ? body.responsavel_id : null,
    p_prioridade: action === "priorizar" ? body.prioridade : null,
    p_relato_conclusao: action === "concluir" ? String(body.relato_conclusao).trim() : null,
    p_machine_status: action === "concluir" ? body.status_maquina : null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ item: data });
}
