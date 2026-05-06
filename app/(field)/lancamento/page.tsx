import { createSupabaseServer } from "@/lib/supabase/server";
import LancamentoForm from "./LancamentoForm";
import type { Atividade, Equipe, Projeto } from "@/lib/types";

export const dynamic = "force-dynamic";

function dedupeAtividadesPorNome(atividades: Atividade[]) {
  const vistos = new Set<string>();
  return atividades.filter((atividade) => {
    const chave = atividade.nome
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

export default async function LancamentoPage() {
  const supabase = await createSupabaseServer();
  const [{ data: equipes }, { data: atividades }, { data: projetos }] = await Promise.all([
    supabase.from("equipes").select("*").eq("ativo", true).order("nome"),
    supabase.from("atividades").select("*").eq("ativo", true).order("nome"),
    supabase.from("projetos").select("*").eq("ativo", true).order("nome"),
  ]);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <h2 className="text-xl font-bold">Novo lançamento</h2>
        <p className="text-sm text-[var(--color-ink-500)]">
          Preencha em poucos toques. Você pode editar nas próximas horas.
        </p>
      </div>
      <LancamentoForm
        equipes={(equipes ?? []) as Equipe[]}
        atividades={dedupeAtividadesPorNome((atividades ?? []) as Atividade[])}
        projetos={(projetos ?? []) as Projeto[]}
      />
    </div>
  );
}
