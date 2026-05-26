import type { SupabaseClient } from "@supabase/supabase-js";

type ProducaoResumo = {
  projeto_id: string | null;
  atividade_id: string | null;
  talhao: string | null;
  data: string | null;
  created_at: string | null;
  quantidade: number | string | null;
  insumos?: unknown;
  projetos?: { nome?: string | null } | null;
  atividades?: { nome?: string | null } | null;
};

type PlanejamentoBase = {
  projeto_id: string;
  atividade_id: string;
  talhao: string;
  quantidade_prevista: number | string | null;
  status?: string | null;
  projetos?: { nome?: string | null } | null;
  atividades?: { nome?: string | null; valor_unitario?: number | string | null } | null;
};

export type PlanejamentoProgress = {
  quantidade_realizada: number;
  pct_realizado: number;
  faturamento_planejado: number;
  data_fechamento: string | null;
  insumos_utilizados: InsumoTotal[];
};

export type InsumoTotal = {
  nome: string;
  quantidade: number;
};

type ProducaoMatch = {
  quantidade: number;
  data: string | null;
  created_at: string | null;
  insumos: InsumoTotal[];
};

type MatchBucket = {
  total: number;
  rows: ProducaoMatch[];
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

function serviceKeys(atividadeNome: string | null | undefined) {
  const normalized = normalizePlanningText(atividadeNome);
  const keys = new Set<string>();

  const isPlantio = /\bplantio\b/.test(normalized);
  const isIrrigacaoPlantio = /\birrigacao\b.*\bplantio\b/.test(normalized);
  if (isPlantio && !isIrrigacaoPlantio) keys.add("plantio");

  if (normalized) keys.add(normalized);
  const semPrefixoServico = normalized
    .replace(/\b(serv|servico)\b/g, " ")
    .replace(/["']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (semPrefixoServico) keys.add(semPrefixoServico);

  return Array.from(keys);
}

function serviceKey(
  projetoNome: string | null | undefined,
  talhao: string | null | undefined,
  atividadeNome: string | null | undefined
) {
  return serviceKeys(atividadeNome).map(
    (key) => `${normalizeProjectName(projetoNome)}|${normalizeTalhao(talhao)}|${key}`
  );
}

function firstPositiveMatch(totals: Map<string, number>, keys: string[]) {
  for (const key of keys) {
    const value = totals.get(key);
    if (value && value > 0) return value;
  }
  return null;
}

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeInsumos(value: unknown): InsumoTotal[] {
  if (!Array.isArray(value)) return [];
  const totals = new Map<string, InsumoTotal>();

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const nome = String(record.nome ?? record.name ?? "").trim();
    const quantidade = toNumber(record.quantidade ?? record.qtd ?? record.quantity);
    if (!nome || quantidade <= 0) continue;

    const key = normalizePlanningText(nome);
    const current = totals.get(key);
    if (current) current.quantidade += quantidade;
    else totals.set(key, { nome, quantidade });
  }

  return Array.from(totals.values()).sort((a, b) => a.nome.localeCompare(b.nome));
}

function addMatchBucket(map: Map<string, MatchBucket>, key: string, row: ProducaoMatch) {
  const current = map.get(key);
  if (current) {
    current.total += row.quantidade;
    current.rows.push(row);
    return;
  }
  map.set(key, { total: row.quantidade, rows: [row] });
}

function firstPositiveBucket(totals: Map<string, MatchBucket>, keys: string[]) {
  for (const key of keys) {
    const value = totals.get(key);
    if (value && value.total > 0) return value;
  }
  return null;
}

function productionDate(row: ProducaoMatch) {
  return row.data ?? row.created_at?.slice(0, 10) ?? null;
}

function orderedRows(rows: ProducaoMatch[]) {
  return [...rows].sort((a, b) => {
    const aDate = productionDate(a) ?? "";
    const bDate = productionDate(b) ?? "";
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    return (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });
}

function closingDate(rows: ProducaoMatch[], prevista: number, status: string | null | undefined) {
  const sorted = orderedRows(rows);
  if (sorted.length === 0) return null;

  if (prevista > 0) {
    let total = 0;
    for (const row of sorted) {
      total += row.quantidade;
      if (total >= prevista) return productionDate(row);
    }
  }

  if (status === "concluido") {
    return productionDate(sorted[sorted.length - 1]);
  }

  return null;
}

function aggregateInsumos(rows: ProducaoMatch[]) {
  const totals = new Map<string, InsumoTotal>();
  for (const row of rows) {
    for (const insumo of row.insumos) {
      const key = normalizePlanningText(insumo.nome);
      const current = totals.get(key);
      if (current) current.quantidade += insumo.quantidade;
      else totals.set(key, { ...insumo });
    }
  }
  return Array.from(totals.values()).sort((a, b) => a.nome.localeCompare(b.nome));
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
        data_fechamento: null,
        insumos_utilizados: [],
      };
    });
  }

  const { data, error } = await supabase
    .from("producao")
    .select("projeto_id, atividade_id, talhao, data, created_at, quantidade, insumos, projetos(nome), atividades(nome)")
    .limit(10000);

  if (error) throw new Error(error.message);

  const exactTotals = new Map<string, number>();
  const namedTotals = new Map<string, number>();
  const serviceTotals = new Map<string, number>();
  const exactBuckets = new Map<string, MatchBucket>();
  const namedBuckets = new Map<string, MatchBucket>();
  const serviceBuckets = new Map<string, MatchBucket>();
  for (const row of (data ?? []) as ProducaoResumo[]) {
    const quantidade = toNumber(row.quantidade);
    const matchRow: ProducaoMatch = {
      quantidade,
      data: row.data,
      created_at: row.created_at,
      insumos: normalizeInsumos(row.insumos),
    };
    const byId = exactKey(row.projeto_id, row.talhao, row.atividade_id);
    const byName = namedKey(row.projetos?.nome, row.talhao, row.atividades?.nome);
    exactTotals.set(byId, (exactTotals.get(byId) ?? 0) + quantidade);
    namedTotals.set(byName, (namedTotals.get(byName) ?? 0) + quantidade);
    addMatchBucket(exactBuckets, byId, matchRow);
    addMatchBucket(namedBuckets, byName, matchRow);
    for (const byService of serviceKey(row.projetos?.nome, row.talhao, row.atividades?.nome)) {
      serviceTotals.set(byService, (serviceTotals.get(byService) ?? 0) + quantidade);
      addMatchBucket(serviceBuckets, byService, matchRow);
    }
  }

  return items.map((item) => {
    const prevista = Number(item.quantidade_prevista ?? 0);
    const realizadaPorId = exactTotals.get(
      exactKey(item.projeto_id, item.talhao, item.atividade_id)
    );
    const realizadaPorNome = namedTotals.get(
      namedKey(item.projetos?.nome, item.talhao, item.atividades?.nome)
    );
    const realizadaPorServico = firstPositiveMatch(
      serviceTotals,
      serviceKey(item.projetos?.nome, item.talhao, item.atividades?.nome)
    );
    const bucketPorId = exactBuckets.get(exactKey(item.projeto_id, item.talhao, item.atividade_id));
    const bucketPorNome = namedBuckets.get(
      namedKey(item.projetos?.nome, item.talhao, item.atividades?.nome)
    );
    const bucketPorServico = firstPositiveBucket(
      serviceBuckets,
      serviceKey(item.projetos?.nome, item.talhao, item.atividades?.nome)
    );
    const atividadePorFamilia = serviceKeys(item.atividades?.nome)[0] === "plantio";
    const realizadaPorChave = realizadaPorId && realizadaPorId > 0
      ? realizadaPorId
      : realizadaPorNome && realizadaPorNome > 0
      ? realizadaPorNome
      : 0;
    const realizada = atividadePorFamilia && realizadaPorServico
      ? realizadaPorServico
      : realizadaPorChave || realizadaPorServico || 0;
    const selectedBucket = atividadePorFamilia && bucketPorServico
      ? bucketPorServico
      : bucketPorId && bucketPorId.total > 0
      ? bucketPorId
      : bucketPorNome && bucketPorNome.total > 0
      ? bucketPorNome
      : bucketPorServico;
    const pct = prevista > 0 ? Math.min((realizada / prevista) * 100, 999) : 0;
    const tarifa = Number(item.atividades?.valor_unitario ?? 0);

    return {
      ...item,
      quantidade_realizada: realizada,
      pct_realizado: pct,
      faturamento_planejado: prevista * tarifa,
      data_fechamento: closingDate(selectedBucket?.rows ?? [], prevista, item.status),
      insumos_utilizados: aggregateInsumos(selectedBucket?.rows ?? []),
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
