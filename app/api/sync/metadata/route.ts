import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  cleanServiceText,
  type ServiceMetadataInput,
  upsertServiceMetadata,
} from "@/lib/service-metadata";
import {
  configuredSyncTokens,
  isAuthorizedSyncRequest,
  syncTokenMissingMessage,
} from "@/lib/sync-auth";

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

type MetadataPayload = {
  spreadsheetName?: string;
  sheetName?: string;
  headers?: unknown[];
  rows?: SheetRowPayload[];
  services?: Array<Record<string, unknown>>;
  editedRange?: {
    rowNumber?: number;
    columnNumber?: number;
    oldValue?: unknown;
    newValue?: unknown;
  };
};

function normalizeHeader(value: unknown) {
  return cleanServiceText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .toLowerCase();
}

function parseNumberBR(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  const raw = cleanServiceText(input);
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

function findHeader(headers: string[], names: string[]) {
  const expected = names.map(normalizeHeader);
  return headers.findIndex((header) => expected.includes(normalizeHeader(header)));
}

function rowValues(row: SheetRowPayload): unknown[] | null {
  return "values" in row && Array.isArray(row.values) ? row.values : null;
}

function rowData(row: SheetRowPayload) {
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
  const expected = names.map(normalizeHeader);
  return Object.entries(data).find(([name]) => expected.includes(normalizeHeader(name)))?.[1];
}

function rowNumber(row: SheetRowPayload) {
  const value = "rowNumber" in row ? row.rowNumber : rowData(row).rowNumber;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function metadataInputFromRow(
  row: SheetRowPayload,
  headers: string[],
  payload: MetadataPayload
): ServiceMetadataInput | null {
  const displayName = cleanServiceText(
    valueAt(row, headers, [
      "Nomenclatura Facilitada",
      "Serviço",
      "Servico",
      "Atividade",
      "Nome",
      "Display Name",
    ])
  );
  if (!displayName) return null;

  const oldValue = cleanServiceText(payload.editedRange?.oldValue);
  const newValue = cleanServiceText(payload.editedRange?.newValue);
  const editedRow = payload.editedRange?.rowNumber
    ? Number(payload.editedRange.rowNumber)
    : null;
  const currentRow = rowNumber(row);
  const oldDisplayName = editedRow && currentRow === editedRow && oldValue && newValue
    ? oldValue
    : null;

  return {
    serviceKey: cleanServiceText(valueAt(row, headers, ["Service ID", "Serviço ID", "Servico ID", "GN Service ID"])) || null,
    oldDisplayName,
    displayName,
    canonicalName: cleanServiceText(valueAt(row, headers, ["Operação", "Operacao"])) || displayName,
    operationCode: cleanServiceText(valueAt(row, headers, ["Código", "Codigo", "Operação Código", "Operacao Codigo"])) || null,
    operationName: cleanServiceText(valueAt(row, headers, ["Operação", "Operacao"])) || null,
    unidade: cleanServiceText(valueAt(row, headers, ["Unid. Medida", "Unidade", "Unid Medida"])) || null,
    escalaRendimento: cleanServiceText(valueAt(row, headers, ["Escala de Rendimento", "Escala"])) || null,
    valorUnitario: parseNumberBR(valueAt(row, headers, ["Preço", "Preco", "Tarifa", "Valor unitário", "Valor unitario"])),
    aliases: [
      cleanServiceText(valueAt(row, headers, ["Serviço", "Servico", "Atividade"])),
      cleanServiceText(valueAt(row, headers, ["Nomenclatura Facilitada"])),
    ].filter(Boolean),
    sourceSpreadsheet: payload.spreadsheetName ?? null,
    sourceSheet: payload.sheetName ?? null,
    sourceRow: currentRow,
    metadata: {
      source_id: "sourceId" in row ? row.sourceId ?? null : null,
      edited_range: payload.editedRange ?? null,
    },
  };
}

function metadataInputFromService(
  service: Record<string, unknown>,
  payload: MetadataPayload
): ServiceMetadataInput | null {
  const displayName = cleanServiceText(
    service.displayName ?? service.display_name ?? service.nome ?? service.servico ?? service["Serviço"]
  );
  if (!displayName) return null;

  return {
    serviceKey: cleanServiceText(service.serviceKey ?? service.service_key ?? service.id) || null,
    oldDisplayName: cleanServiceText(service.oldDisplayName ?? service.old_display_name) || null,
    displayName,
    canonicalName: cleanServiceText(service.canonicalName ?? service.canonical_name) || displayName,
    operationCode: cleanServiceText(service.operationCode ?? service.operation_code ?? service.codigo) || null,
    operationName: cleanServiceText(service.operationName ?? service.operation_name ?? service.operacao) || null,
    unidade: cleanServiceText(service.unidade ?? service.unit) || null,
    escalaRendimento: cleanServiceText(service.escalaRendimento ?? service.escala_rendimento) || null,
    valorUnitario: parseNumberBR(service.valorUnitario ?? service.valor_unitario ?? service.tarifa),
    aliases: Array.isArray(service.aliases) ? service.aliases.map(cleanServiceText) : [],
    sourceSpreadsheet: payload.spreadsheetName ?? null,
    sourceSheet: payload.sheetName ?? null,
    sourceRow: Number(service.rowNumber ?? service.row_number) || null,
    metadata: { raw: service },
  };
}

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

  const payload = (await req.json()) as MetadataPayload;
  const headers = (payload.headers ?? []).map(cleanServiceText);
  const rows = Array.isArray(payload.rows) ? payload.rows.slice(0, 1000) : [];
  const services = Array.isArray(payload.services) ? payload.services.slice(0, 1000) : [];
  const inputs = [
    ...services.map((service) => metadataInputFromService(service, payload)),
    ...rows.map((row) => metadataInputFromRow(row, headers, payload)),
  ].filter((item): item is ServiceMetadataInput => Boolean(item));

  if (inputs.length === 0) {
    return NextResponse.json(
      { error: "Nenhum servico valido enviado para sincronizacao." },
      { status: 400 }
    );
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const results = [];
  for (const input of inputs) {
    try {
      const result = await upsertServiceMetadata(supabase, input);
      results.push({
        status: "ok",
        service_key: result.service.service_key,
        atividade_id: result.atividade.id,
        display_name: result.service.display_name,
      });
    } catch (error) {
      results.push({
        status: "error",
        display_name: input.displayName,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json(
    {
      synced_at: new Date().toISOString(),
      received: inputs.length,
      ok: results.filter((result) => result.status === "ok").length,
      errors: results.filter((result) => result.status === "error").length,
      results,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
