import type { SupabaseClient } from "@supabase/supabase-js";

type ProducaoResumo = {
  projeto_id: string | null;
  atividade_id: string | null;
  talhao: string | null;
  quantidade: number | string | null;
  projetos?: { nome?: string | null } | null;
  atividades?: { nome?: string | null } | null;
};

type PlanejamentoBase = {
  projeto_id: string;
  atividade_id: string;
  talhao: string;
  quantidade_prevista: number | string | null;
  projetos?: { nome?: string | null } | null;
  atividades?: { nome?: string | null; valor_unitario?: number | string | null } | null;
};

export type PlanejamentoProgress = {
  quantidade_realizada: number;
  pct_realizado: number;
  faturamento_planejado: number;
};

export function normalizeTalhao(talhao: string | null | undefined) {
  return String(talhao ?? "").trim().toLowerCase();
}

export function normalizePlanningText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[º°ª]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeProjectName(value: string | null | undefined) {
  return normalizePlanningText(value).replace(/\s*-\s*(srp|rrp|cpg)\s*$/i, "").trim();
}

function exactKey(
  projetoId: string | null | undefined,
  talhao: string | null | undefined,
  atividadeId: string | null | undefined
) {
  return `${projetoId ?? ""}|${normalizeTalhao(talhao)}|${atividadeId ?? ""}`;
}

function namedKey(
  projetoNome: string | null | undefined,
  talhao: string | null | undefined,
  atividadeNome: string | null | undefined
) {
  return `${normalizeProjectName(projetoNome)}|${normalizeTalhao(talhao)}|${normalizePlanningText(atividadeNome)}`;
}

export async function enrichPlanningProgress<T extends PlanejamentoBase>(
  supabase: Pick<SupabaseClient, "from">,
  items: T[]
): Promise<Array<T & PlanejamentoProgress>> {
  if (items.length === 0) return [];

  if (items.some((item) => !item.projeto_id || !item.atividade_id)) {
    return items.map((item) => {
      const prevista = Number(item.quantidade_prevista ?? 0);
      const tarifa = Number(item.atividades?.valor_unitario ?? 0);
      return {
        ...item,
        quantidade_realizada: 0,
        pct_realizado: 0,
        faturamento_planejado: prevista * tarifa,
      };
    });
  }

  const { data, error } = await supabase
    .from("producao")
    .select("projeto_id, atividade_id, talhao, quantidade, projetos(nome), atividades(nome)")
    .limit(10000);

  if (error) throw new Error(error.message);

  const exactTotals = new Map<string, number>();
  const namedTotals = new Map<string, number>();
  for (const row of (data ?? []) as ProducaoResumo[]) {
    const quantidade = Number(row.quantidade ?? 0);
    const byId = exactKey(row.projeto_id, row.talhao, row.atividade_id);
    const byName = namedKey(row.projetos?.nome, row.talhao, row.atividades?.nome);
    exactTotals.set(byId, (exactTotals.get(byId) ?? 0) + quantidade);
    namedTotals.set(byName, (namedTotals.get(byName) ?? 0) + quantidade);
  }

  return items.map((item) => {
    const prevista = Number(item.quantidade_prevista ?? 0);
    const realizadaPorId = exactTotals.get(
      exactKey(item.projeto_id, item.talhao, item.atividade_id)
    );
    const realizadaPorNome = namedTotals.get(
      namedKey(item.projetos?.nome, item.talhao, item.atividades?.nome)
    );
    const realizada = realizadaPorId && realizadaPorId > 0
      ? realizadaPorId
      : realizadaPorNome ?? realizadaPorId ?? 0;
    const pct = prevista > 0 ? Math.min((realizada / prevista) * 100, 999) : 0;
    const tarifa = Number(item.atividades?.valor_unitario ?? 0);

    return {
      ...item,
      quantidade_realizada: realizada,
      pct_realizado: pct,
      faturamento_planejado: prevista * tarifa,
    };
  });
}

export async function syncPlanningProgressForProduction(
  supabase: Pick<SupabaseClient, "rpc">,
  row: { projeto_id?: string | null; talhao?: string | null; atividade_id?: string | null } | null | undefined
) {
  if (!row?.projeto_id || !row.talhao || !row.atividade_id) return null;

  const { error } = await supabase.rpc("sync_planejamento_progress", {
    p_projeto_id: row.projeto_id,
    p_talhao: row.talhao,
    p_atividade_id: row.atividade_id,
  });

  return error;
}
