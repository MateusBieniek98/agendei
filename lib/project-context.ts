import type { SupabaseClient } from "@supabase/supabase-js";
import type { OperationalAllocation, Talhao } from "@/lib/types";

type PlotInput = {
  projeto_id?: unknown;
  talhao_id?: unknown;
  talhao?: unknown;
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
