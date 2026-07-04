import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import LancamentosTable from "./LancamentosTable";
import type { Atividade, Equipe, Projeto } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LancamentosAdminPage() {
  const supabase = await createSupabaseServer();
  const [{ data: equipes }, { data: atividades }, { data: projetos }] = await Promise.all([
    supabase.from("equipes").select("*").order("nome"),
    supabase.from("atividades").select("*").order("nome"),
    supabase.from("projetos").select("*").eq("ativo", true).order("nome"),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lançamentos de produção</h1>
          <p className="text-sm font-semibold text-[var(--color-ink-600)]">
            Filtre por período, equipe ou atividade. Registre, edite ou exclua apontamentos.
          </p>
        </div>
        <Link
          href="/admin/lancamentos/novo"
          className="inline-flex h-12 items-center justify-center rounded-xl bg-[var(--color-gn-600)] px-4 text-base font-bold text-white shadow-sm transition hover:bg-[var(--color-gn-700)]"
        >
          + Novo lançamento
        </Link>
      </div>
      <LancamentosTable
        equipes={(equipes ?? []) as Equipe[]}
        atividades={(atividades ?? []) as Atividade[]}
        projetos={(projetos ?? []) as Projeto[]}
      />
    </div>
  );
}
