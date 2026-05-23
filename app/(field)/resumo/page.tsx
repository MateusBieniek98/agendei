import { requireRole } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { resolvePreset } from "@/lib/period";
import ResultadosFeed, { type ResultadoLinha } from "./ResultadosFeed";
import type { Atividade } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ResumoFieldPage() {
  const profile = await requireRole(["encarregado", "admin"]);
  const supabase = await createSupabaseServer();
  const ciclo = resolvePreset("ciclo_atual");

  const shouldLoadFeed = profile.role !== "encarregado" || !!profile.equipe_id;
  let query = supabase
    .from("producao")
    .select(
      "id, data, equipe_id, atividade_id, projeto_id, talhao, quantidade, observacoes, " +
        "valor_unitario_snapshot, created_at, equipes(nome), atividades(nome, unidade), projetos(nome)"
    )
    .gte("data", ciclo.de)
    .lte("data", ciclo.ate)
    .order("data", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(300);

  if (profile.role === "encarregado" && profile.equipe_id) {
    query = query.eq("equipe_id", profile.equipe_id);
  }

  const linhasPromise = shouldLoadFeed ? query : Promise.resolve({ data: [] });

  const [{ data: linhas }, { data: atividades }] = await Promise.all([
    linhasPromise,
    supabase.from("atividades").select("*").eq("ativo", true).order("nome"),
  ]);

  return (
    <ResultadosFeed
      linhas={(linhas ?? []) as unknown as ResultadoLinha[]}
      atividades={(atividades ?? []) as Atividade[]}
      equipeId={profile.role === "encarregado" ? profile.equipe_id ?? "" : null}
      ciclo={{ de: ciclo.de, ate: ciclo.ate, label: ciclo.label }}
    />
  );
}
