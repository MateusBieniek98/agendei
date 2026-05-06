import type { SupabaseClient } from "@supabase/supabase-js";

type ProducaoResumo = {
  projeto_id: string | null;
  atividade_id: string | null;
  talhao: string | null;
  quantidade: number | string | null;
};

type PlanejamentoBase = {
  projeto_id: string;
  atividade_id: string;
  talhao: string;
  quantidade_prevista: number | string | null;
  atividades?: { valor_unitario?: number | string | null } | null;
};

export type PlanejamentoProgress = {
  quantidade_realizada: number;
  pct_realizado: number;
  faturamento_planejado: number;
};

export function normalizeTalhao(talhao: string | null | undefined) {
  return String(talhao ?? "").trim().toLowerCase();
}

function key(projetoId: string | null | undefined, talhao: string | null | undefined, atividadeId: string | null | undefined) {
  return `${projetoId ?? ""}|${normalizeTalhao(talhao)}|${atividadeId ?? ""}`;
}

export async function enrichPlanningProgress<T extends PlanejamentoBase>(
  supabase: Pick<SupabaseClient, "from">,
  items: T[]
): Promise<Array<T & PlanejamentoProgress>> {
  if (items.length === 0) return [];

  const projectIds = Array.from(new Set(items.map((p) => p.projeto_id).filter(Boolean)));
  const activityIds = Array.from(new Set(items.map((p) => p.atividade_id).filter(Boolean)));
  if (projectIds.length === 0 || activityIds.length === 0) {
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
    .select("projeto_id, atividade_id, talhao, quantidade")
    .in("projeto_id", projectIds)
    .in("atividade_id", activityIds)
    .limit(10000);

  if (error) throw new Error(error.message);

  const totals = new Map<string, number>();
  for (const row of (data ?? []) as ProducaoResumo[]) {
    const k = key(row.projeto_id, row.talhao, row.atividade_id);
    totals.set(k, (totals.get(k) ?? 0) + Number(row.quantidade ?? 0));
  }

  return items.map((item) => {
    const prevista = Number(item.quantidade_prevista ?? 0);
    const realizada = totals.get(key(item.projeto_id, item.talhao, item.atividade_id)) ?? 0;
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
