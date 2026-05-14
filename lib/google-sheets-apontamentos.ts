import { primarySyncToken } from "@/lib/sync-auth";

type SheetsProductionEvent = "criado" | "editado" | "excluido" | "manual";
export type SheetsSyncAction = "atualizar_apontamentos" | "rodar_fluxo_completo";

const WEBHOOK_HINT =
  "Configure GOOGLE_SHEETS_APONTAMENTOS_WEBHOOK_URL no Vercel com a URL do Apps Script publicado como Web App, terminando em /exec. Nao use o link da planilha ou do Google Drive.";

function validateWebhookUrl(webhookUrl: string) {
  try {
    const url = new URL(webhookUrl);
    const host = url.hostname.toLowerCase();

    if (host === "docs.google.com" || host === "drive.google.com") {
      return `URL de webhook invalida: ela aponta para ${host}. ${WEBHOOK_HINT}`;
    }

    if (
      !host.endsWith("script.google.com") &&
      !host.endsWith("script.googleusercontent.com")
    ) {
      return `URL de webhook invalida: esperava um dominio do Apps Script. ${WEBHOOK_HINT}`;
    }

    if (host.endsWith("script.google.com") && !url.pathname.endsWith("/exec")) {
      return `URL de webhook invalida: o link do Apps Script deve terminar em /exec. ${WEBHOOK_HINT}`;
    }
  } catch {
    return `URL de webhook invalida. ${WEBHOOK_HINT}`;
  }

  return null;
}

function formatWebhookFailure(status: number, text: string) {
  const trimmed = text.trim();

  if (trimmed.startsWith("<!DOCTYPE") || trimmed.includes("<html")) {
    return (
      `Falha ao atualizar Apontamentos App: HTTP ${status}. ` +
      "O Google retornou uma pagina HTML em vez de JSON. " +
      WEBHOOK_HINT
    );
  }

  return `Falha ao atualizar Apontamentos App: HTTP ${status}${
    trimmed ? ` - ${trimmed.slice(0, 500)}` : ""
  }`;
}

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

  const webhookUrlError = validateWebhookUrl(webhookUrl);
  if (webhookUrlError) return webhookUrlError;

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
      return formatWebhookFailure(response.status, text);
    }

    if (text) {
      let payload: { ok?: boolean; error?: string };
      try {
        payload = JSON.parse(text) as { ok?: boolean; error?: string };
      } catch {
        return (
          "Apps Script respondeu, mas nao retornou JSON valido. " +
          "Publique o script como Web App e use a URL /exec."
        );
      }
      if (payload.ok === false) {
        return payload.error || "Apps Script recusou a atualizacao da planilha.";
      }
    }

    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
