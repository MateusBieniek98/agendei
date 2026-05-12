/**
 * POST /api/sync/projetos
 *
 * Recebe uma lista de projetos da planilha Google Sheets e faz upsert na
 * tabela `projetos` usando o nome como chave natural (coluna tem UNIQUE).
 *
 * Protegido pelo mesmo SHARED_SYNC_TOKEN dos outros endpoints de sync.
 *
 * Payload aceito (qualquer um dos formatos):
 *
 *   { projetos: [{ nome: "Fazenda X", ativo: true }, ...] }
 *
 *   { headers: ["Projeto", "Ativo"], rows: [{ values: ["Fazenda X", true], rowNumber: 2 }] }
 *
 *   { headers: ["Projeto"], rows: [{ data: { Projeto: "Fazenda X" }, rowNumber: 2 }] }
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cleanServiceText } from "@/lib/service-metadata";
import {
  configuredSyncTokens,
  isAuthorizedSyncRequest,
  syncTokenMissingMessage,
} from "@/lib/sync-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ─── tipos ───────────────────────────────────────────────────────────────────

type SheetRow =
  | { rowNumber?: number; values?: unknown[]; data?: Record<string, unknown> }
  | Record<string, unknown>;

type ProjetosPayload = {
  spreadsheetName?: string;
  projetos?: Array<Record<string, unknown>>;
  headers?: unknown[];
  rows?: SheetRow[];
};

type ProjetoInput = {
  nome: string;
  ativo: boolean;
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function normalizeHeader(value: unknown) {
  return cleanServiceText(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function findHeader(headers: string[], candidates: string[]) {
  const expected = candidates.map(normalizeHeader);
  return headers.findIndex((h) => expected.includes(normalizeHeader(h)));
}

function getValue(row: SheetRow, headers: string[], candidates: string[]): unknown {
  if ("values" in row && Array.isArray(row.values)) {
    const idx = findHeader(headers, candidates);
    return idx >= 0 ? row.values[idx] : undefined;
  }
  const data =
    "data" in row && row.data && typeof row.data === "object"
      ? (row.data as Record<string, unknown>)
      : (row as Record<string, unknown>);
  const expected = candidates.map(normalizeHeader);
  return Object.entries(data).find(([k]) => expected.includes(normalizeHeader(k)))?.[1];
}

function parseProjeto(
  raw: Record<string, unknown>,
  headers: string[]
): ProjetoInput | null {
  const nomeCandidates = [
    "Projeto",
    "Fazenda",
    "nome",
    "name",
    "Name",
    "Fazenda / Projeto",
  ];
  const asRow = raw as SheetRow;
  const nome = cleanServiceText(
    getValue(asRow, headers, nomeCandidates) ??
      raw.nome ??
      raw.Projeto ??
      raw.Fazenda ??
      raw.name ??
      ""
  );
  if (!nome) return null;

  const ativoRaw =
    getValue(asRow, headers, ["Ativo", "Ativa", "Ativo?", "Active"]) ??
    raw.ativo ??
    true;
  const ativo =
    typeof ativoRaw === "boolean"
      ? ativoRaw
      : !["false", "inativo", "não", "nao", "0"].includes(
          String(ativoRaw ?? "").toLowerCase().trim()
        );

  return { nome, ativo };
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

  const payload = (await req.json()) as ProjetosPayload;
  const headers = (payload.headers ?? []).map((h) => cleanServiceText(h));

  // Aceita tanto { projetos: [...] } quanto { rows: [...] }
  const rawItems: Array<Record<string, unknown>> = [
    ...(Array.isArray(payload.projetos) ? payload.projetos : []),
    ...(Array.isArray(payload.rows) ? (payload.rows as Array<Record<string, unknown>>) : []),
  ].slice(0, 2000);

  const inputs = rawItems
    .map((raw) => parseProjeto(raw, headers))
    .filter((item): item is ProjetoInput => item !== null);

  if (inputs.length === 0) {
    return NextResponse.json(
      { error: "Nenhum projeto valido encontrado no payload." },
      { status: 400 }
    );
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });

  const results: Array<{
    status: string;
    nome: string;
    id?: string;
    message?: string;
  }> = [];

  for (const input of inputs) {
    try {
      const { data, error } = await supabase
        .from("projetos")
        .upsert({ nome: input.nome, ativo: input.ativo }, { onConflict: "nome" })
        .select("id, nome, ativo")
        .single();

      if (error) throw new Error(error.message);
      results.push({ status: "ok", nome: (data as { id: string; nome: string }).nome, id: (data as { id: string }).id });
    } catch (err) {
      results.push({
        status: "error",
        nome: input.nome,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json(
    {
      synced_at: new Date().toISOString(),
      spreadsheetName: payload.spreadsheetName ?? null,
      received: inputs.length,
      ok: results.filter((r) => r.status === "ok").length,
      errors: results.filter((r) => r.status === "error").length,
      results,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
