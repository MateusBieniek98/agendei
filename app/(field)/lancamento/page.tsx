import { createSupabaseServer } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { resolvePreset } from "@/lib/period";
import LancamentoForm from "./LancamentoForm";
import type { Atividade, Equipe, Producao, Projeto } from "@/lib/types";

export const dynamic = "force-dynamic";

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

export default async function LancamentoPage({
  searchParams,
}: {
  searchParams: Promise<{
    atividade_id?: string;
    projeto_id?: string;
    talhao?: string;
    edit_id?: string;
  }>;
}) {
  const profile = await requireRole(["encarregado", "admin"]);
  const supabase = await createSupabaseServer();
  const params   = await searchParams;
  const ciclo = resolvePreset("ciclo_atual");

  const editPromise = params.edit_id
    ? supabase
        .from("producao")
        .select(
          "id, data, equipe_id, atividade_id, projeto_id, talhao, quantidade, insumos, descarte, observacoes, " +
            "valor_unitario_snapshot, registrado_por, editado_por, created_at, updated_at"
        )
        .eq("id", params.edit_id)
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

  if (params.edit_id && !canEdit) {
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
      <div>
        <h2 className="text-xl font-bold">
          {editing ? "Editar lançamento" : "Novo lançamento"}
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {editing
            ? "Revise os campos e reenvie o apontamento da equipe."
            : "Preencha em poucos toques."}
        </p>
      </div>
      <LancamentoForm
        equipes={(equipes ?? []) as Equipe[]}
        atividades={dedupeAtividadesPorNome((atividades ?? []) as Atividade[], editing?.atividade_id)}
        projetos={(projetos ?? []) as Projeto[]}
        initialAtividadeId={params.atividade_id}
        initialProjetoId={params.projeto_id}
        initialTalhao={params.talhao}
        editingItem={editing ?? undefined}
      />
    </div>
  );
}
