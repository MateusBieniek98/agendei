/**
 * POST /api/sync/planejamento
 *
 * Recebe linhas da aba "Programação Mensal" (ou similar) da planilha
 * "Planejamento de atividades - GN" e faz upsert na tabela `planejamento`.
 *
 * • Projetos, atividades e equipes são resolvidos por nome (criados se não
 *   existirem).
 * • Cada linha é identificada por `origem_chave` =
 *   `{spreadsheetId}:{sheetName}:{rowNumber}` — editar a linha na planilha
 *   atualiza o mesmo registro no banco.
 * • Ano e mês são lidos do payload ou derivados do nome da planilha
 *   (ex.: "MAIO2026" → mes=5, ano=2026).
 *
 * Protegido pelo mesmo SHARED_SYNC_TOKEN dos outros endpoints de sync.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cleanServiceText, upsertServiceMetadata } from "@/lib/service-metadata";
import { normalizePlanningText, normalizeProjectName } from "@/lib/planning-progress";
import {
  configuredSyncTokens,
  isAuthorizedSyncRequest,
  syncTokenMissingMessage,
} from "@/lib/sync-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ─── tipos ───────────────────────────────────────────────────────────────────

type SheetRow =
  | { rowNumber?: number; sourceId?: string; values?: unknown[]; data?: Record<string, unknown> }
  | Record<string, unknown>;

type PlanejamentoPayload = {
  spreadsheetId?: string;
  spreadsheetName?: string;
  sheetName?: string;
  ano?: number;
  mes?: number;
  headers?: unknown[];
  rows?: SheetRow[];
  dryRun?: boolean;
};

type EntityRow = { id: string; nome: string; ativo?: boolean; unidade?: string; valor_unitario?: number | string | null };
type EntityMap = Map<string, EntityRow>;

type PlanningStatus = "planejado" | "em_execucao" | "concluido" | "cancelado";

// ─── helpers de texto ─────────────────────────────────────────────────────────

function clean(v: unknown) {
  return cleanServiceText(v);
}

function normalizeHeader(v: unknown) {
  return normalizePlanningText(clean(v)).replace(/\./g, "");
}

function findHeader(headers: string[], candidates: string[]) {
  const expected = candidates.map(normalizeHeader);
  return headers.findIndex((h) => expected.includes(normalizeHeader(h)));
}

function getValue(row: SheetRow, headers: string[], candidates: string[]): unknown {
  if ("values" in row && Array.isArray(row.values)) {
    const idx = findHeader(headers, candidates);
    return idx >= 0 ? (row as { values: unknown[] }).values[idx] : undefined;
  }
  const data =
    "data" in row && (row as Record<string, unknown>).data
      ? ((row as Record<string, unknown>).data as Record<string, unknown>)
      : (row as Record<string, unknown>);
  const expected = candidates.map(normalizeHeader);
  return Object.entries(data).find(([k]) => expected.includes(normalizeHeader(k)))?.[1];
}

function rowNumber(row: SheetRow): number | null {
  const v = (row as Record<string, unknown>).rowNumber;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ─── parsers ──────────────────────────────────────────────────────────────────

function parseNumberBR(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  const raw = clean(input);
  if (!raw) return null;
  let s = raw.replace(/R\$/gi, "").replace(/\s/g, "").replace(/[^\d,.-]/g, "");
  if (!s || s === "-" || s === ",") return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

const PT_MONTHS: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, março: 3, abril: 4, maio: 5,
  junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

const SHORT_MONTHS: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

/** Tenta derivar { ano, mes } do nome da planilha (ex: "MAIO2026", "Mai/2026"). */
function parsePeriodFromName(name: string): { ano: number; mes: number } | null {
  const upper = name.toUpperCase();

  // "MAIO2026", "MARCO2026"
  for (const [ptName, mes] of Object.entries(PT_MONTHS)) {
    if (upper.includes(ptName.toUpperCase())) {
      const anoMatch = name.match(/\d{4}/);
      if (anoMatch) return { ano: Number(anoMatch[0]), mes };
    }
  }

  // "Mai/2026", "05/2026"
  const mSlash = name.match(/(\d{1,2})[/-](\d{4})/);
  if (mSlash) return { ano: Number(mSlash[2]), mes: Number(mSlash[1]) };

  return null;
}

function parseDateISO(input: unknown): string | null {
  const raw = clean(input);
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (br) {
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${year}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  }
  return null;
}

function parsePlanningStatus(value: unknown): PlanningStatus {
  const normalized = normalizePlanningText(clean(value));
  if (normalized.includes("execucao") || normalized.includes("andamento")) return "em_execucao";
  if (normalized.includes("conclu")) return "concluido";
  if (normalized.includes("cancel")) return "cancelado";
  return "planejado";
}

// ─── resolução de entidades ───────────────────────────────────────────────────

type AdminSupabase = Pick<SupabaseClient, "from" | "rpc">;

async function loadMaps(supabase: AdminSupabase): Promise<{ projetos: EntityMap; equipes: EntityMap; atividades: EntityMap }> {
  const [pRes, eRes, aRes] = await Promise.all([
    (supabase as SupabaseClient).from("projetos").select("id, nome, ativo").limit(10000),
    (supabase as SupabaseClient).from("equipes").select("id, nome, ativo").limit(10000),
    (supabase as SupabaseClient).from("atividades").select("id, nome, unidade, valor_unitario, ativo").limit(10000),
  ]);
  for (const r of [pRes, eRes, aRes]) if (r.error) throw new Error(r.error.message);

  const projetos: EntityMap = new Map();
  for (const r of (pRes.data ?? []) as EntityRow[]) {
    projetos.set(normalizeProjectName(r.nome), r);
  }

  const equipes: EntityMap = new Map();
  for (const r of (eRes.data ?? []) as EntityRow[]) {
    equipes.set(normalizePlanningText(r.nome), r);
  }

  const atividades: EntityMap = new Map();
  for (const r of (aRes.data ?? []) as EntityRow[]) {
    atividades.set(normalizePlanningText(r.nome), r);
  }

  return { projetos, equipes, atividades };
}

async function ensureProjeto(supabase: SupabaseClient, maps: { projetos: EntityMap }, nome: string): Promise<EntityRow> {
  const key = normalizeProjectName(nome);
  const existing = maps.projetos.get(key);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("projetos")
    .upsert({ nome, ativo: true }, { onConflict: "nome" })
    .select("id, nome, ativo")
    .single();
  if (error) throw new Error(`Projeto "${nome}": ${error.message}`);
  const row = data as EntityRow;
  maps.projetos.set(normalizeProjectName(row.nome), row);
  return row;
}

async function ensureEquipe(supabase: SupabaseClient, maps: { equipes: EntityMap }, nome: string): Promise<EntityRow> {
  const key = normalizePlanningText(nome);
  const existing = maps.equipes.get(key);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("equipes")
    .insert({ nome, descricao: "Criada via sync do planejamento.", ativo: true })
    .select("id, nome, ativo")
    .single();
  if (error) throw new Error(`Equipe "${nome}": ${error.message}`);
  const row = data as EntityRow;
  maps.equipes.set(normalizePlanningText(row.nome), row);
  return row;
}

async function ensureAtividade(
  supabase: SupabaseClient,
  maps: { atividades: EntityMap },
  nome: string,
  valorUnitario: number | null
): Promise<EntityRow> {
  const key = normalizePlanningText(nome);
  const existing = maps.atividades.get(key);
  if (existing) return existing;

  const result = await upsertServiceMetadata(supabase as Parameters<typeof upsertServiceMetadata>[0], {
    displayName: nome,
    valorUnitario,
    sourceSheet: "Planejamento",
    metadata: { origem: "sync_planejamento" },
  });
  const row = result.atividade as unknown as EntityRow;
  maps.atividades.set(normalizePlanningText(row.nome), row);
  return row;
}

// ─── processamento de linha ───────────────────────────────────────────────────

async function processRow(
  supabase: SupabaseClient,
  maps: ReturnType<typeof loadMaps> extends Promise<infer T> ? T : never,
  row: SheetRow,
  headers: string[],
  payload: PlanejamentoPayload,
  defaultAno: number,
  defaultMes: number,
  dryRun: boolean
) {
  const lineNum = rowNumber(row);

  const projetoNome = clean(getValue(row, headers, ["Projeto", "Fazenda", "Fazenda / Projeto"]));
  const talhao = clean(getValue(row, headers, ["Talhão", "Talhao", "Talhao/Quadra", "Talhão/Quadra"]));
  const atividadeNome = clean(getValue(row, headers, ["Atividade", "Serviço", "Servico", "Operação", "Operacao"]));
  const equipeNome = clean(getValue(row, headers, ["Equipe", "Frente", "Time"]));
  const qtd = parseNumberBR(getValue(row, headers, ["Quantidade Prevista", "Qtd Prevista", "Previsto", "Quantidade"]));
  const dataInicio = parseDateISO(getValue(row, headers, ["Data Início", "Data Inicio", "Inicio"]));
  const dataLimite = parseDateISO(getValue(row, headers, ["Data Limite", "Prazo", "Data Fim", "Data Final", "Fim"]));
  const status = parsePlanningStatus(getValue(row, headers, ["Status"]));
  const obs = clean(getValue(row, headers, ["Observações", "Observacoes", "Obs"]));
  const valorUnitario = parseNumberBR(getValue(row, headers, ["Tarifa", "Preço", "Preco", "Valor Unitário", "Valor Unitario"]));

  // Ano/Mês: prioridade coluna > payload > nome da planilha
  const anoCol = parseNumberBR(getValue(row, headers, ["Ano"]));
  const mesCol = parseNumberBR(getValue(row, headers, ["Mês", "Mes"]));
  const ano = (anoCol && anoCol > 2000 ? anoCol : null) ?? defaultAno;
  const mes = (mesCol && mesCol >= 1 && mesCol <= 12 ? mesCol : null) ?? defaultMes;

  // Chave única para upsert
  const spreadsheetId = clean(payload.spreadsheetId) || "unknown";
  const sheetName = clean(payload.sheetName) || "Planejamento";
  const origemChave = `${spreadsheetId}:${sheetName}:${lineNum ?? "norow"}`;

  // Validação mínima
  if (!projetoNome || !talhao || !atividadeNome) {
    return {
      rowNumber: lineNum,
      status: "ignored",
      message: "Linha ignorada: projeto, talhão ou atividade ausentes.",
    };
  }

  // Data limite obrigatória no schema — deriva do fim do mês se ausente
  const dataLimiteFinal = dataLimite ?? `${ano}-${String(mes).padStart(2, "0")}-28`;

  if (dryRun) {
    return {
      rowNumber: lineNum,
      status: "validated",
      preview: { projetoNome, talhao, atividadeNome, equipeNome, qtd, dataInicio, dataLimite: dataLimiteFinal, status, ano, mes },
    };
  }

  const projeto = await ensureProjeto(supabase, maps, projetoNome);
  const atividade = await ensureAtividade(supabase, maps, atividadeNome, valorUnitario);
  const equipe = equipeNome ? await ensureEquipe(supabase, maps, equipeNome) : null;

  const upsertPayload = {
    ano,
    mes,
    projeto_id: projeto.id,
    talhao,
    atividade_id: atividade.id,
    equipe_id: equipe?.id ?? null,
    quantidade_prevista: qtd,
    data_inicio: dataInicio,
    data_limite: dataLimiteFinal,
    status,
    observacoes: obs || null,
    origem_chave: origemChave,
    origem_planilha: clean(payload.spreadsheetName),
    origem_aba: sheetName,
    origem_linha: lineNum,
    import_metadata: {
      synced_at: new Date().toISOString(),
      tarifa_planilha: valorUnitario,
    },
  };

  const { data, error } = await supabase
    .from("planejamento")
    .upsert(upsertPayload, { onConflict: "origem_chave" })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  return {
    rowNumber: lineNum,
    status: "ok",
    planejamentoId: (data as { id: string }).id,
    projeto: projetoNome,
    talhao,
    atividade: atividadeNome,
  };
}

// ─── handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (configuredSyncTokens().length === 0) {
    return NextResponse.json({ error: syncTokenMissingMessage() }, { status: 500 });
  }
  if (!isAuthorizedSyncRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY nao configurada no servidor." },
      { status: 500 }
    );
  }

  const payload = (await req.json()) as PlanejamentoPayload;
  const rows = Array.isArray(payload.rows) ? payload.rows.slice(0, 5000) : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: "Nenhuma linha enviada para importacao." }, { status: 400 });
  }

  const headers = (payload.headers ?? []).map((h) => clean(h));
  const dryRun = payload.dryRun === true;

  // Ano/Mês padrão: do payload ou derivado do nome da planilha
  const spreadsheetName = clean(payload.spreadsheetName);
  const periodFromName = parsePeriodFromName(spreadsheetName);
  const shortMonthKeys = Object.keys(SHORT_MONTHS);
  const periodFromShortName = shortMonthKeys.reduce<{ ano: number; mes: number } | null>((acc, key) => {
    if (acc) return acc;
    const upper = spreadsheetName.toUpperCase();
    if (upper.includes(key.toUpperCase())) {
      const anoMatch = spreadsheetName.match(/\d{4}/);
      if (anoMatch) return { ano: Number(anoMatch[0]), mes: SHORT_MONTHS[key] };
    }
    return null;
  }, null);

  const now = new Date();
  const defaultAno = payload.ano ?? periodFromName?.ano ?? periodFromShortName?.ano ?? now.getFullYear();
  const defaultMes = payload.mes ?? periodFromName?.mes ?? periodFromShortName?.mes ?? now.getMonth() + 1;

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  }) as SupabaseClient;

  let maps: Awaited<ReturnType<typeof loadMaps>>;
  try {
    maps = await loadMaps(supabase);
  } catch (err) {
    return NextResponse.json(
      { error: `Erro ao carregar dados do banco: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }

  const results: unknown[] = [];
  for (const row of rows) {
    try {
      results.push(await processRow(supabase, maps, row, headers, payload, defaultAno, defaultMes, dryRun));
    } catch (err) {
      results.push({
        rowNumber: rowNumber(row),
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json(
    {
      synced_at: new Date().toISOString(),
      dryRun,
      spreadsheetName,
      sheetName: payload.sheetName,
      ano: defaultAno,
      mes: defaultMes,
      received: rows.length,
      ok: (results as Array<{ status: string }>).filter((r) => r.status === "ok").length,
      ignored: (results as Array<{ status: string }>).filter((r) => r.status === "ignored").length,
      errors: (results as Array<{ status: string }>).filter((r) => r.status === "error").length,
      results,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
