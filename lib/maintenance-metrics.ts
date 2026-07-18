import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MaintenancePriority,
  MaintenanceStatus,
  ManutencaoIndicadores,
} from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;

type OpenMaintenanceRow = {
  id: string;
  maquina_id: string;
  descricao: string;
  status: MaintenanceStatus;
  prioridade: MaintenancePriority;
  situacao_atual: string | null;
  situacao_atualizada_em: string | null;
  parada_desde: string | null;
  created_at: string;
  maquinas: { nome: string; identificador: string | null } | null;
  responsavel: { nome: string } | null;
};

type ResolvedMaintenanceRow = {
  parada_desde: string | null;
  parada_ate: string | null;
  created_at: string;
  resolvido_em: string | null;
};

function timestamp(value: string | null | undefined) {
  const parsed = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function maintenanceElapsedDays(
  start: string | null | undefined,
  end: string | null | undefined,
  now = new Date()
) {
  const startTime = timestamp(start);
  const endTime = timestamp(end) ?? now.getTime();
  if (startTime == null) return 0;
  return Math.max(0, (endTime - startTime) / DAY_MS);
}

export function calculateMaintenanceIndicators(
  openRows: OpenMaintenanceRow[],
  resolvedRows: ResolvedMaintenanceRow[],
  now = new Date()
): ManutencaoIndicadores {
  const paradas = openRows
    .map((row) => ({
      id: row.id,
      maquina_id: row.maquina_id,
      maquina_nome: row.maquinas?.nome ?? "Máquina removida",
      maquina_identificador: row.maquinas?.identificador ?? null,
      descricao: row.descricao,
      status: row.status,
      prioridade: row.prioridade,
      situacao_atual: row.situacao_atual?.trim() || "Aguardando manutenção",
      situacao_atualizada_em: row.situacao_atualizada_em ?? row.created_at,
      parada_desde: row.parada_desde ?? row.created_at,
      dias_parada: Math.floor(
        maintenanceElapsedDays(row.parada_desde ?? row.created_at, null, now)
      ),
      responsavel_nome: row.responsavel?.nome ?? null,
    }))
    .sort((a, b) => b.dias_parada - a.dias_parada || a.parada_desde.localeCompare(b.parada_desde));

  const resolvedDurations = resolvedRows
    .map((row) => maintenanceElapsedDays(
      row.parada_desde ?? row.created_at,
      row.parada_ate ?? row.resolvido_em,
      now
    ))
    .filter((value) => Number.isFinite(value));
  const average = resolvedDurations.length
    ? resolvedDurations.reduce((sum, value) => sum + value, 0) / resolvedDurations.length
    : 0;

  return {
    maquinas_paradas: new Set(openRows.map((row) => row.maquina_id)).size,
    aguardando: openRows.filter((row) => row.status === "aberto").length,
    em_atendimento: openRows.filter((row) => row.status === "em_andamento").length,
    resolvidos_30d: resolvedRows.length,
    tempo_medio_parado_dias: Math.round(average * 10) / 10,
    maior_tempo_aberto_dias: paradas[0]?.dias_parada ?? 0,
    faixas: {
      ate_2_dias: paradas.filter((item) => item.dias_parada <= 2).length,
      de_3_a_7_dias: paradas.filter((item) => item.dias_parada >= 3 && item.dias_parada <= 7).length,
      acima_7_dias: paradas.filter((item) => item.dias_parada > 7).length,
    },
    paradas,
  };
}

export async function getMaintenanceIndicators(
  supabase: SupabaseClient,
  now = new Date()
) {
  const since = new Date(now.getTime() - 30 * DAY_MS).toISOString();
  const [{ data: openRows, error: openError }, { data: resolvedRows, error: resolvedError }] =
    await Promise.all([
      supabase
        .from("manutencoes")
        .select(
          "id, maquina_id, descricao, status, prioridade, situacao_atual, situacao_atualizada_em, parada_desde, created_at, maquinas(nome,identificador), responsavel:profiles!manutencoes_responsavel_id_fkey(nome)"
        )
        .neq("status", "resolvido")
        .order("parada_desde", { ascending: true }),
      supabase
        .from("manutencoes")
        .select("parada_desde, parada_ate, created_at, resolvido_em")
        .eq("status", "resolvido")
        .gte("resolvido_em", since),
    ]);

  if (openError) throw openError;
  if (resolvedError) throw resolvedError;
  return calculateMaintenanceIndicators(
    (openRows ?? []) as unknown as OpenMaintenanceRow[],
    (resolvedRows ?? []) as ResolvedMaintenanceRow[],
    now
  );
}
