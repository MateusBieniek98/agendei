import { createSupabaseServer } from "@/lib/supabase/server";
import MaintenanceFeed from "@/components/maintenance/MaintenanceFeed";
import type { Equipe, Maquina, ProjetoComTalhoes } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MaquinasFieldPage() {
  const supabase = await createSupabaseServer();
  const [{ data: maquinas }, { data: equipes }, { data: projetos }] = await Promise.all([
    supabase.from("maquinas").select("*").eq("ativo", true).order("nome"),
    supabase.from("equipes").select("*").eq("ativo", true).order("nome"),
    supabase.from("projetos").select("*, talhoes(*)").eq("ativo", true).eq("talhoes.ativo", true).order("nome"),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <MaintenanceFeed
        mode="field"
        maquinas={(maquinas ?? []) as Maquina[]}
        equipes={(equipes ?? []) as Equipe[]}
        projetos={(projetos ?? []) as ProjetoComTalhoes[]}
      />
    </div>
  );
}
