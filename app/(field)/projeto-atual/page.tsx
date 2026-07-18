import ProjectDashboard from "@/components/projects/ProjectDashboard";
import { requireRole } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CurrentProjectPage() {
  const profile = await requireRole(["encarregado", "admin"]);
  const supabase = await createSupabaseServer();
  const { data: allocation } = profile.equipe_id
    ? await supabase.from("alocacoes_operacionais").select("projeto_id").eq("equipe_id", profile.equipe_id).is("encerrado_em", null).maybeSingle()
    : { data: null };
  return <ProjectDashboard mode="field" initialProjectId={allocation?.projeto_id ?? null} />;
}
