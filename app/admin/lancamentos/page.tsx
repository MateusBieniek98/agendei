import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
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
      <PageHeader
        eyebrow="Produção"
        title="Lançamentos de produção"
        subtitle="Filtre por período, equipe ou atividade. Registre, edite ou exclua apontamentos."
        right={
          <Link
            href="/admin/lancamentos/novo"
            className="inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-bold text-white transition"
            style={{ background: "var(--accent)", borderColor: "var(--accent)" }}
          >
            + Novo lançamento
          </Link>
        }
      />
      <LancamentosTable
        equipes={(equipes ?? []) as Equipe[]}
        atividades={(atividades ?? []) as Atividade[]}
        projetos={(projetos ?? []) as Projeto[]}
      />
    </div>
  );
}
