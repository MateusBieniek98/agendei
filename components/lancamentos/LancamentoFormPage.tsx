import { createSupabaseServer } from "@/lib/supabase/server";
import { resolvePreset } from "@/lib/period";
import LancamentoForm from "@/app/(field)/lancamento/LancamentoForm";
import PageHeader from "@/components/ui/PageHeader";
import type { Atividade, Equipe, Producao, Profile, Projeto } from "@/lib/types";

export type LancamentoFormSearchParams = {
  atividade_id?: string;
  projeto_id?: string;
  talhao?: string;
  edit_id?: string;
};

type LancamentoFormPageProps = {
  profile: Profile;
  searchParams: LancamentoFormSearchParams;
  title?: string;
  subtitle?: string;
  afterCreateHref?: string;
  afterEditHref?: string;
  resetAfterCreate?: boolean;
};

function dedupeAtividadesPorNome(atividades: Atividade[], preferredId?: string) {
  const vistos = new Set<string>();
  const result: Atividade[] = [];

  for (const atividade of atividades) {
    const chave = atividade.nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    if (vistos.has(chave) && atividade.id !== preferredId) continue;
    if (vistos.has(chave) && atividade.id === preferredId) {
      const index = result.findIndex((item) => {
        const itemKey = item.nome
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
        return itemKey === chave;
      });
      if (index >= 0) result.splice(index, 1);
    }
    vistos.add(chave);
    result.push(atividade);
  }

  return result;
}

export default async function LancamentoFormPage({
  profile,
  searchParams,
  title,
  subtitle,
  afterCreateHref,
  afterEditHref,
  resetAfterCreate,
}: LancamentoFormPageProps) {
  const supabase = await createSupabaseServer();
  const ciclo = resolvePreset("ciclo_atual");

  const editPromise = searchParams.edit_id
    ? supabase
        .from("producao")
        .select(
          "id, data, equipe_id, atividade_id, projeto_id, talhao, quantidade, insumos, descarte, estoque_controlado, observacoes, " +
            "valor_unitario_snapshot, registrado_por, editado_por, created_at, updated_at"
        )
        .eq("id", searchParams.edit_id)
        .maybeSingle()
    : Promise.resolve({ data: null });

  const [{ data: equipes }, { data: atividades }, { data: projetos }, { data: editingRaw }] = await Promise.all([
    supabase.from("equipes").select("*").eq("ativo", true).order("nome"),
    supabase.from("atividades").select("*").eq("ativo", true).order("nome"),
    supabase.from("projetos").select("*").eq("ativo", true).order("nome"),
    editPromise,
  ]);

  const editing = editingRaw as Producao | null;
  const canEdit =
    !!editing &&
    editing.data >= ciclo.de &&
    editing.data <= ciclo.ate &&
    (profile.role === "admin" ||
      editing.registrado_por === profile.id ||
      (profile.role === "encarregado" && profile.equipe_id === editing.equipe_id));

  if (searchParams.edit_id && !canEdit) {
    return (
      <div className="mx-auto max-w-md">
        <div
          className="rounded-lg border p-5 text-sm font-semibold"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          Este apontamento não está disponível para edição no ciclo atual.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <PageHeader
        eyebrow="Produção"
        title={title ?? (editing ? "Editar lançamento" : "Novo lançamento")}
        subtitle={subtitle ?? (editing ? "Revise os campos e reenvie o apontamento da equipe." : "Preencha em poucos toques.")}
      />
      <LancamentoForm
        equipes={(equipes ?? []) as Equipe[]}
        atividades={dedupeAtividadesPorNome((atividades ?? []) as Atividade[], editing?.atividade_id)}
        projetos={(projetos ?? []) as Projeto[]}
        initialAtividadeId={searchParams.atividade_id}
        initialProjetoId={searchParams.projeto_id}
        initialTalhao={searchParams.talhao}
        editingItem={editing ?? undefined}
        afterCreateHref={afterCreateHref}
        afterEditHref={afterEditHref}
        resetAfterCreate={resetAfterCreate}
      />
    </div>
  );
}
