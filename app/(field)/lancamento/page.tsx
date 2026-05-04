import { createSupabaseServer } from "@/lib/supabase/server";
import LancamentoForm from "./LancamentoForm";
import type { Atividade, Equipe } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LancamentoPage() {
  const supabase = await createSupabaseServer();
  const [{ data: equipes }, { data: atividades }] = await Promise.all([
    supabase.from("equipes").select("*").eq("ativo", true).order("nome"),
    supabase.from("atividades").select("*").eq("ativo", true).order("nome"),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Novo lançamento</h2>
        <p className="text-sm text-[var(--color-ink-500)]">
          Preencha em poucos toques. Você pode editar nas próximas horas.
        </p>
      </div>
      <LancamentoForm
        equipes={(equipes ?? []) as Equipe[]}
        atividades={(atividades ?? []) as Atividade[]}
      />
    </div>
  );
}
