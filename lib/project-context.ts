import type { SupabaseClient } from "@supabase/supabase-js";
import type { OperationalAllocation, Talhao } from "@/lib/types";

type PlotInput = {
  projeto_id?: unknown;
  talhao_id?: unknown;
  talhao?: unknown;
};

export type ResolvedProductionPlot = {
  id: string | null;
  projeto_id: string;
  codigo: string;
};

export async function resolveActivePlot(supabase: SupabaseClient, input: PlotInput) {
  const projetoId = String(input.projeto_id ?? "").trim();
  const talhaoId = String(input.talhao_id ?? "").trim();
  const codigo = String(input.talhao ?? "").trim();

  let query = supabase
    .from("talhoes")
    .select("id, projeto_id, codigo, area_ha, ativo, observacoes, created_at, updated_at, projetos!inner(id, ativo)")
    .eq("ativo", true)
    .eq("projetos.ativo", true);

  if (talhaoId) query = query.eq("id", talhaoId);
  else if (projetoId && codigo) query = query.eq("projeto_id", projetoId).ilike("codigo", codigo);
  else throw new Error("Selecione projeto e talhão.");

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Talhão inexistente, inativo ou fora do projeto selecionado.");
  if (projetoId && data.projeto_id !== projetoId) {
    throw new Error("O talhão não pertence ao projeto selecionado.");
  }

  return data as unknown as Talhao;
}

export async function resolveProductionPlot(
  supabase: SupabaseClient,
  input: PlotInput
): Promise<ResolvedProductionPlot> {
  const projetoId = String(input.projeto_id ?? "").trim();
  const talhaoId = String(input.talhao_id ?? "").trim();
  const codigo = String(input.talhao ?? "").trim();

  if (!projetoId || (!talhaoId && !codigo)) {
    throw new Error("Selecione o projeto e informe o talhão.");
  }

  if (talhaoId) {
    const plot = await resolveActivePlot(supabase, input);
    return { id: plot.id, projeto_id: plot.projeto_id, codigo: plot.codigo };
  }

  const { data: officialPlot, error: plotError } = await supabase
    .from("talhoes")
    .select("id, projeto_id, codigo, projetos!inner(id, ativo)")
    .eq("projeto_id", projetoId)
    .ilike("codigo", codigo)
    .eq("ativo", true)
    .eq("projetos.ativo", true)
    .limit(1)
    .maybeSingle();

  if (plotError) throw plotError;
  if (officialPlot) {
    return {
      id: officialPlot.id,
      projeto_id: officialPlot.projeto_id,
      codigo: officialPlot.codigo,
    };
  }

  const { data: projeto, error: projetoError } = await supabase
    .from("projetos")
    .select("id")
    .eq("id", projetoId)
    .eq("ativo", true)
    .maybeSingle();

  if (projetoError) throw projetoError;
  if (!projeto) throw new Error("Projeto inexistente ou inativo.");

  return { id: null, projeto_id: projetoId, codigo };
}

export async function getActiveAllocation(
  supabase: SupabaseClient,
  resourceType: "equipe" | "maquina",
  resourceId: string
) {
  const column = resourceType === "equipe" ? "equipe_id" : "maquina_id";
  const { data, error } = await supabase
    .from("alocacoes_operacionais")
    .select("*, projetos(nome), talhoes(id, codigo, area_ha, ativo), equipes(nome), maquinas(nome, identificador, status), autor:profiles!alocacoes_operacionais_alocado_por_fkey(nome)")
    .eq(column, resourceId)
    .is("encerrado_em", null)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as OperationalAllocation | null;
}
