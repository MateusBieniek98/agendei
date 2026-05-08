import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sanitizeInsumos } from "@/lib/insumos";
import {
  normalizePlanningText,
  normalizeProjectName,
  syncPlanningProgressForProduction,
} from "@/lib/planning-progress";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SheetRowPayload =
  | {
      rowNumber?: number;
      sourceId?: string;
      values?: unknown[];
      data?: Record<string, unknown>;
    }
  | Record<string, unknown>;

type ImportPayload = {
  spreadsheetName?: string;
  sheetName?: string;
  headers?: unknown[];
  rows?: SheetRowPayload[];
  dryRun?: boolean;
  atualizarCadastros?: boolean;
};

type EntityRow = {
  id: string;
  nome: string;
  ativo?: boolean;
  unidade?: string;
  valor_unitario?: number | string | null;
  role?: string;
  email?: string;
};

type ImportMaps = {
  projetos: Map<string, EntityRow>;
  equipes: Map<string, EntityRow>;
  atividades: Map<string, EntityRow>;
  profiles: Map<string, EntityRow>;
  defaultProfileId: string;
};

type GenericTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

type GnDatabase = {
  public: {
    Tables: Record<
      "projetos" | "equipes" | "atividades" | "profiles" | "producao",
      GenericTable
    >;
    Views: Record<string, never>;
    Functions: {
      sync_planejamento_progress: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
    };
    Enums: Record<string, string>;
    CompositeTypes: Record<string, never>;
  };
};

type AdminSupabase = SupabaseClient<GnDatabase, "public", "public">;

const SOURCE_NAME = "google_sheets";
const DEFAULT_SPREADSHEET_NAME = "Controle de Produção GN";
const DEFAULT_SHEET_NAME = "Registro de atividades";
const MAX_ROWS_PER_REQUEST = 5000;

function bearer(req: NextRequest) {
  const header = req.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

function requestedToken(req: NextRequest) {
  return bearer(req) || req.nextUrl.searchParams.get("token") || "";
}

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function key(value: unknown) {
  return normalizePlanningText(cleanText(value));
}

function headerKey(value: unknown) {
  return key(value).replace(/\./g, "");
}

function sourceKey(value: string) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "");
}

function findHeader(headers: string[], names: string[]) {
  const normalizedNames = names.map(headerKey);
  return headers.findIndex((header) => normalizedNames.includes(headerKey(header)));
}

function rowValues(row: SheetRowPayload): unknown[] | null {
  if ("values" in row && Array.isArray(row.values)) return row.values;
  return null;
}

function rowData(row: SheetRowPayload): Record<string, unknown> {
  if ("data" in row && row.data && typeof row.data === "object") {
    return row.data as Record<string, unknown>;
  }
  return row && typeof row === "object" ? (row as Record<string, unknown>) : {};
}

function valueAt(row: SheetRowPayload, headers: string[], names: string[]) {
  const values = rowValues(row);
  if (values) {
    const index = findHeader(headers, names);
    return index >= 0 ? values[index] : undefined;
  }

  const data = rowData(row);
  const expected = names.map(headerKey);
  const entry = Object.entries(data).find(([name]) => expected.includes(headerKey(name)));
  return entry?.[1];
}

function rowNumber(row: SheetRowPayload) {
  const value = row && typeof row === "object" ? (row as Record<string, unknown>).rowNumber : null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function explicitSourceId(row: SheetRowPayload) {
  const data = rowData(row);
  return cleanText(
    data.sourceId ?? data.__sourceId ?? data["GN App ID"] ?? data["gn_app_id"] ?? ""
  );
}

function parseNumberBR(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  const raw = cleanText(input);
  if (!raw) return null;

  let normalized = raw
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");

  if (!normalized || normalized === "-" || normalized === ",") return null;

  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

const PT_MONTHS: Record<string, string> = {
  janeiro: "01",
  fevereiro: "02",
  marco: "03",
  março: "03",
  abril: "04",
  maio: "05",
  junho: "06",
  julho: "07",
  agosto: "08",
  setembro: "09",
  outubro: "10",
  novembro: "11",
  dezembro: "12",
};

function parseDateISO(input: unknown): string | null {
  const raw = cleanText(input);
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const br = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (br) {
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${year}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  }

  const longPt = normalizePlanningText(raw).match(
    /(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/
  );
  if (longPt) {
    const month = PT_MONTHS[longPt[2]] ?? PT_MONTHS[longPt[2].replace("ç", "c")];
    if (month) return `${longPt[3]}-${month}-${longPt[1].padStart(2, "0")}`;
  }

  return null;
}

function inferUnitFromActivity(nome: string) {
  const normalized = normalizePlanningText(nome);
  if (normalized.includes(" km") || normalized.includes("tracado km")) return "km";
  if (normalized.includes("hora")) return "h";
  if (normalized.includes("diaria") || normalized.includes("caminhao pipa")) return "diaria";
  return "ha";
}

function hashSource(row: SheetRowPayload, headers: string[], sheetName: string) {
  const values = rowValues(row);
  const serialized = JSON.stringify(values ?? rowData(row));
  return createHash("sha256").update(`${sheetName}|${serialized}`).digest("hex").slice(0, 24);
}

function getInsumos(row: SheetRowPayload, headers: string[]) {
  const values = rowValues(row);

  if (values) {
    const insumos = headers.flatMap((header, index) => {
      if (!headerKey(header).startsWith("insumo")) return [];
      const nome = cleanText(values[index]);
      if (!nome) return [];

      let qtd: unknown = null;
      for (let i = index + 1; i < headers.length; i += 1) {
        const h = headerKey(headers[i]);
        if (h.startsWith("insumo")) break;
        if (h === "qtd" || h.startsWith("qtd ") || h.startsWith("quantidade")) {
          qtd = values[i];
          break;
        }
      }

      return [{ nome, quantidade: parseNumberBR(qtd) ?? 0 }];
    });
    return sanitizeInsumos(insumos);
  }

  const data = rowData(row);
  const insumos = Array.from({ length: 5 }, (_, index) => {
    const numero = index + 1;
    return {
      nome: data[`Insumo ${numero}`],
      quantidade: data[`QTD ${numero}`] ?? data[`Qtd ${numero}`] ?? data[`QTD`],
    };
  });
  return sanitizeInsumos(insumos);
}

function addEntity(map: Map<string, EntityRow>, row: EntityRow, project = false) {
  map.set(project ? normalizeProjectName(row.nome) : key(row.nome), row);
}

async function loadImportMaps(supabase: AdminSupabase): Promise<ImportMaps> {
  const [projetos, equipes, atividades, profiles] = await Promise.all([
    supabase.from("projetos").select("id, nome, ativo").limit(10000),
    supabase.from("equipes").select("id, nome, ativo").limit(10000),
    supabase.from("atividades").select("id, nome, unidade, valor_unitario, ativo").limit(10000),
    supabase.from("profiles").select("id, nome, email, role").limit(10000),
  ]);

  for (const response of [projetos, equipes, atividades, profiles]) {
    if (response.error) throw new Error(response.error.message);
  }

  const projetoMap = new Map<string, EntityRow>();
  const equipeMap = new Map<string, EntityRow>();
  const atividadeMap = new Map<string, EntityRow>();
  const profileMap = new Map<string, EntityRow>();

  for (const row of (projetos.data ?? []) as EntityRow[]) addEntity(projetoMap, row, true);
  for (const row of (equipes.data ?? []) as EntityRow[]) addEntity(equipeMap, row);
  for (const row of (atividades.data ?? []) as EntityRow[]) addEntity(atividadeMap, row);

  const profileRows = (profiles.data ?? []) as EntityRow[];
  for (const row of profileRows) {
    const profileKeys = [
      key(row.nome),
      key(row.email),
      key(String(row.email ?? "").split("@")[0]),
      key(String(row.nome ?? "").split(" ")[0]),
    ].filter(Boolean);
    for (const profileKey of profileKeys) profileMap.set(profileKey, row);
  }

  const admin = profileRows.find((row) => row.role === "admin") ?? profileRows[0];
  if (!admin) throw new Error("Nenhum perfil encontrado em public.profiles.");

  return {
    projetos: projetoMap,
    equipes: equipeMap,
    atividades: atividadeMap,
    profiles: profileMap,
    defaultProfileId: admin.id,
  };
}

async function ensureProjeto(
  supabase: AdminSupabase,
  maps: ImportMaps,
  nome: string
) {
  const mapKey = normalizeProjectName(nome);
  const existing = maps.projetos.get(mapKey);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("projetos")
    .insert({ nome, ativo: true })
    .select("id, nome, ativo")
    .single();
  if (error) throw new Error(`Projeto "${nome}": ${error.message}`);

  const row = data as EntityRow;
  addEntity(maps.projetos, row, true);
  return row;
}

async function ensureEquipe(
  supabase: AdminSupabase,
  maps: ImportMaps,
  nome: string
) {
  const safeName = nome || "Sem equipe informada";
  const mapKey = key(safeName);
  const existing = maps.equipes.get(mapKey);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("equipes")
    .insert({
      nome: safeName,
      descricao: `Criada pela importacao da aba ${DEFAULT_SHEET_NAME}.`,
      ativo: true,
    })
    .select("id, nome, ativo")
    .single();
  if (error) throw new Error(`Equipe "${safeName}": ${error.message}`);

  const row = data as EntityRow;
  addEntity(maps.equipes, row);
  return row;
}

async function ensureAtividade(
  supabase: AdminSupabase,
  maps: ImportMaps,
  nome: string,
  tarifa: number | null,
  atualizarCadastros: boolean
) {
  const mapKey = key(nome);
  const existing = maps.atividades.get(mapKey);
  if (existing) {
    if (atualizarCadastros && tarifa !== null && tarifa > 0) {
      await supabase
        .from("atividades")
        .update({ valor_unitario: tarifa, ativo: true })
        .eq("id", existing.id);
      existing.valor_unitario = tarifa;
      existing.ativo = true;
    }
    return existing;
  }

  const { data, error } = await supabase
    .from("atividades")
    .insert({
      nome,
      unidade: inferUnitFromActivity(nome),
      valor_unitario: tarifa ?? 0,
      ativo: true,
    })
    .select("id, nome, unidade, valor_unitario, ativo")
    .single();
  if (error) throw new Error(`Atividade "${nome}": ${error.message}`);

  const row = data as EntityRow;
  addEntity(maps.atividades, row);
  return row;
}

function normalizeHeaders(input: unknown[] | undefined) {
  return (input ?? []).map((header) => cleanText(header));
}

async function importRow(
  supabase: AdminSupabase,
  maps: ImportMaps,
  row: SheetRowPayload,
  headers: string[],
  spreadsheetName: string,
  sheetName: string,
  atualizarCadastros: boolean,
  dryRun: boolean
) {
  const line = rowNumber(row);
  const data = parseDateISO(valueAt(row, headers, ["Data"]));
  const atividadeNome = cleanText(valueAt(row, headers, ["Serviço", "Servico", "Atividade"]));
  const projetoNome = cleanText(valueAt(row, headers, ["Projeto", "Fazenda"]));
  const talhao = cleanText(valueAt(row, headers, ["Talhão", "Talhao"]));
  const equipeNome = cleanText(valueAt(row, headers, ["Equipe", "Frente"]));
  const encarregado = cleanText(valueAt(row, headers, ["Encarregado", "Lançado por", "Lancado por"]));
  const quantidade = parseNumberBR(valueAt(row, headers, ["Produção", "Producao", "Quantidade"]));
  const descarte = parseNumberBR(valueAt(row, headers, ["Descarte"]));
  const faturamentoPlanilha = parseNumberBR(
    valueAt(row, headers, ["Faturamento da Atividade", "Faturamento"])
  );
  let tarifa = parseNumberBR(valueAt(row, headers, ["Tarifa", "Preço", "Preco"]));

  if ((tarifa === null || tarifa <= 0) && faturamentoPlanilha && quantidade && quantidade > 0) {
    tarifa = faturamentoPlanilha / quantidade;
  }

  const sourceId = explicitSourceId(row) || hashSource(row, headers, sheetName);
  const origemChave = `${sourceKey(spreadsheetName)}:${sourceKey(sheetName)}:${sourceId}`;

  if (!data || !atividadeNome || !projetoNome || !talhao || !quantidade || quantidade <= 0) {
    return {
      sourceId,
      rowNumber: line,
      status: "ignored",
      message: "Linha ignorada: data, serviço, projeto, talhão ou produção inválidos.",
    };
  }

  if (dryRun) {
    return {
      sourceId,
      rowNumber: line,
      status: "validated",
      message: "Linha valida para importacao.",
      preview: {
        data,
        projeto: projetoNome,
        talhao,
        atividade: atividadeNome,
        equipe: equipeNome || "Sem equipe informada",
        encarregado,
        quantidade,
        tarifa,
        descarte,
        insumos: getInsumos(row, headers),
      },
    };
  }

  const projeto = await ensureProjeto(supabase, maps, projetoNome);
  const equipe = await ensureEquipe(supabase, maps, equipeNome);
  const atividade = await ensureAtividade(supabase, maps, atividadeNome, tarifa, atualizarCadastros);
  const profile =
    maps.profiles.get(key(encarregado)) ??
    maps.profiles.get(key(encarregado.split(" ")[0])) ??
    null;

  const valorUnitario = tarifa ?? Number(atividade.valor_unitario ?? 0);
  const insumos = getInsumos(row, headers);

  const payload = {
    data,
    equipe_id: equipe.id,
    atividade_id: atividade.id,
    projeto_id: projeto.id,
    talhao,
    quantidade,
    insumos,
    descarte,
    observacoes: [
      `Importado da planilha ${spreadsheetName}, aba ${sheetName}${line ? `, linha ${line}` : ""}.`,
      encarregado ? `Encarregado informado: ${encarregado}.` : "",
      faturamentoPlanilha !== null
        ? `Faturamento na planilha: ${faturamentoPlanilha.toFixed(2)}.`
        : "",
    ]
      .filter(Boolean)
      .join(" "),
    valor_unitario_snapshot: valorUnitario,
    registrado_por: profile?.id ?? maps.defaultProfileId,
    origem: SOURCE_NAME,
    origem_planilha: spreadsheetName,
    origem_aba: sheetName,
    origem_linha: line,
    origem_chave: origemChave,
    import_metadata: {
      source_id: sourceId,
      row_number: line,
      encarregado_planilha: encarregado || null,
      equipe_planilha: equipeNome || null,
      faturamento_planilha: faturamentoPlanilha,
      inicio: cleanText(valueAt(row, headers, ["Inicio", "Início"])),
      finalizado_data: cleanText(valueAt(row, headers, ["Finalizado data"])),
    },
    importado_em: new Date().toISOString(),
  };

  const { data: saved, error } = await supabase
    .from("producao")
    .upsert(payload, { onConflict: "origem_chave" })
    .select("id, projeto_id, talhao, atividade_id")
    .single();

  if (error) throw new Error(error.message);
  const savedRow = saved as {
    id: string;
    projeto_id: string | null;
    talhao: string | null;
    atividade_id: string | null;
  };
  const syncError = await syncPlanningProgressForProduction(supabase, savedRow);

  return {
    sourceId,
    rowNumber: line,
    status: "ok",
    producaoId: savedRow.id,
    planejamento_sync_error: syncError?.message ?? null,
  };
}

export async function POST(req: NextRequest) {
  const expectedToken = process.env.GOOGLE_SHEETS_SYNC_TOKEN;
  if (!expectedToken) {
    return NextResponse.json(
      { error: "GOOGLE_SHEETS_SYNC_TOKEN nao configurado no servidor." },
      { status: 500 }
    );
  }

  if (requestedToken(req) !== expectedToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY nao configurada no servidor." },
      { status: 500 }
    );
  }

  const body = (await req.json()) as ImportPayload;
  const rows = Array.isArray(body.rows) ? body.rows.slice(0, MAX_ROWS_PER_REQUEST) : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: "Nenhuma linha enviada para importacao." }, { status: 400 });
  }

  const headers = normalizeHeaders(body.headers);
  const spreadsheetName = cleanText(body.spreadsheetName) || DEFAULT_SPREADSHEET_NAME;
  const sheetName = cleanText(body.sheetName) || DEFAULT_SHEET_NAME;
  const dryRun = body.dryRun === true;
  const atualizarCadastros = body.atualizarCadastros !== false;

  const supabase: AdminSupabase = createClient<GnDatabase, "public", "public">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    }
  );

  try {
    const maps = await loadImportMaps(supabase);
    const results = [];

    for (const row of rows) {
      try {
        results.push(
          await importRow(
            supabase,
            maps,
            row,
            headers,
            spreadsheetName,
            sheetName,
            atualizarCadastros,
            dryRun
          )
        );
      } catch (error) {
        results.push({
          sourceId: explicitSourceId(row),
          rowNumber: rowNumber(row),
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return NextResponse.json(
      {
        imported_at: new Date().toISOString(),
        dryRun,
        spreadsheetName,
        sheetName,
        received: rows.length,
        ok: results.filter((r) => r.status === "ok").length,
        ignored: results.filter((r) => r.status === "ignored").length,
        errors: results.filter((r) => r.status === "error").length,
        results,
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
