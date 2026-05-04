import { createSupabaseServer } from "@/lib/supabase/server";
import LancamentosTable from "./LancamentosTable";
import type { Atividade, Equipe } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LancamentosAdminPage() {
  const supabase = await createSupabaseServer();
  const [{ data: equipes }, { data: atividades }] = await Promise.all([
    supabase.from("equipes").select("*").order("nome"),
    supabase.from("atividades").select("*").order("nome"),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Lançamentos de produção</h1>
        <p className="text-sm text-[var(--color-ink-500)]">
          Filtre por período, equipe ou atividade. Edição inline e exclusão.
        </p>
      </div>
      <LancamentosTable
        equipes={(equipes ?? []) as Equipe[]}
        atividades={(atividades ?? []) as Atividade[]}
      />
    </div>
  );
}
