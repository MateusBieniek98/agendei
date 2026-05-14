import { primarySyncToken } from "@/lib/sync-auth";

type SheetsProductionEvent = "criado" | "editado" | "excluido" | "manual";
export type SheetsSyncAction = "atualizar_apontamentos" | "rodar_fluxo_completo";

export async function notifyApontamentosSheet(
  evento: SheetsProductionEvent,
  producaoId?: string | null,
  options: {
    acao?: SheetsSyncAction;
    solicitadoPor?: string | null;
    timeoutMs?: number;
  } = {}
) {
  const webhookUrl =
    process.env.GOOGLE_SHEETS_APONTAMENTOS_WEBHOOK_URL?.trim() ||
    process.env.GOOGLE_SHEETS_WEBHOOK_URL?.trim() ||
    "";

  if (!webhookUrl) return null;

  const token =
    process.env.GOOGLE_SHEETS_SYNC_TOKEN?.trim() ||
    process.env.SHARED_SYNC_TOKEN?.trim() ||
    primarySyncToken();

  if (!token) return "Token de sincronizacao da planilha nao configurado.";

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token,
        acao: options.acao ?? "atualizar_apontamentos",
        evento,
        producaoId: producaoId ?? null,
        solicitadoPor: options.solicitadoPor ?? null,
        origem: "gn-app",
        timestamp: new Date().toISOString(),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(options.timeoutMs ?? 8000),
    });

    const text = await response.text().catch(() => "");

    if (!response.ok) {
      return `Falha ao atualizar Apontamentos App: HTTP ${response.status}${text ? ` - ${text}` : ""}`;
    }

    if (text) {
      const payload = JSON.parse(text) as { ok?: boolean; error?: string };
      if (payload.ok === false) {
        return payload.error || "Apps Script recusou a atualizacao da planilha.";
      }
    }

    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
