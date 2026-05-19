import { primarySyncToken } from "@/lib/sync-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SheetsProductionEvent = "criado" | "editado" | "excluido" | "manual";
export type SheetsSyncAction = "atualizar_apontamentos" | "rodar_fluxo_completo";

type SyncJobPayload = {
  acao: SheetsSyncAction;
  evento: SheetsProductionEvent;
  producaoId: string | null;
  solicitadoPor: string | null;
};

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

function syncJobDedupeKey(payload: SyncJobPayload) {
  return payload.producaoId
    ? `producao:${payload.producaoId}`
    : `acao:${payload.acao}`;
}

async function recordSheetSyncJob(payload: SyncJobPayload, lastError: string | null) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return;

  const now = new Date().toISOString();
  const status = lastError ? "pendente" : "concluido";
  const dedupeKey = syncJobDedupeKey(payload);

  const { error } = await supabase
    .from("sync_jobs")
    .upsert(
      {
        tipo: "apontamentos_sheet",
        dedupe_key: dedupeKey,
        status,
        evento: payload.evento,
        producao_id: payload.producaoId,
        payload,
        last_error: lastError,
        attempts: lastError ? undefined : 0,
        scheduled_at: now,
        updated_at: now,
      },
      { onConflict: "tipo,dedupe_key" }
    );

  if (error) {
    console.warn("Falha ao registrar sync_jobs:", error.message);
  }
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

function configuredWebhookUrl() {
  return (
    process.env.GOOGLE_SHEETS_APONTAMENTOS_WEBHOOK_URL?.trim() ||
    process.env.GOOGLE_SHEETS_WEBHOOK_URL?.trim() ||
    ""
  );
}

async function sendApontamentosSheetWebhook(payload: SyncJobPayload, timeoutMs: number) {
  const webhookUrl = configuredWebhookUrl();

  if (!webhookUrl) return "Webhook da planilha nao configurado.";

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
        acao: payload.acao,
        evento: payload.evento,
        producaoId: payload.producaoId,
        solicitadoPor: payload.solicitadoPor,
        origem: "gn-app",
        timestamp: new Date().toISOString(),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
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

export async function notifyApontamentosSheet(
  evento: SheetsProductionEvent,
  producaoId?: string | null,
  options: {
    acao?: SheetsSyncAction;
    solicitadoPor?: string | null;
    timeoutMs?: number;
  } = {}
) {
  if (!configuredWebhookUrl()) return null;

  const payload: SyncJobPayload = {
    acao: options.acao ?? "atualizar_apontamentos",
    evento,
    producaoId: producaoId ?? null,
    solicitadoPor: options.solicitadoPor ?? null,
  };

  const error = await sendApontamentosSheetWebhook(payload, options.timeoutMs ?? 5000);
  await recordSheetSyncJob(payload, error);
  return error;
}

export async function retryPendingApontamentosSheetSyncJobs(limit = 25) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return {
      ok: false,
      error: "SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_URL nao configurada.",
    };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("sync_jobs")
    .select("id, payload, attempts, max_attempts")
    .eq("tipo", "apontamentos_sheet")
    .in("status", ["pendente", "erro"])
    .lte("scheduled_at", now)
    .lt("attempts", 8)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) return { ok: false, error: error.message };

  const jobs = (data ?? []) as {
    id: string;
    payload: SyncJobPayload;
    attempts: number;
    max_attempts: number;
  }[];

  let enviados = 0;
  let falhas = 0;

  for (const job of jobs) {
    const attempts = Number(job.attempts ?? 0) + 1;
    await supabase
      .from("sync_jobs")
      .update({ status: "processando", attempts, locked_at: new Date().toISOString() })
      .eq("id", job.id);

    const sendError = await sendApontamentosSheetWebhook(job.payload, 5000);
    if (!sendError) {
      enviados += 1;
      await supabase
        .from("sync_jobs")
        .update({
          status: "concluido",
          last_error: null,
          locked_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      continue;
    }

    falhas += 1;
    const maxAttempts = Number(job.max_attempts ?? 8);
    const delayMinutes = Math.min(60, 2 ** Math.min(attempts, 6));
    const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();

    await supabase
      .from("sync_jobs")
      .update({
        status: attempts >= maxAttempts ? "erro" : "pendente",
        last_error: sendError,
        locked_at: null,
        scheduled_at: scheduledAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
  }

  return {
    ok: falhas === 0,
    total: jobs.length,
    enviados,
    falhas,
  };
}
