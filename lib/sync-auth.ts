import type { NextRequest } from "next/server";

const SYNC_TOKEN_ENV_NAMES = ["SHARED_SYNC_TOKEN", "GOOGLE_SHEETS_SYNC_TOKEN"] as const;

function bearer(req: NextRequest) {
  const header = req.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

export function requestedSyncToken(req: NextRequest) {
  return bearer(req) || req.nextUrl.searchParams.get("token")?.trim() || "";
}

export function configuredSyncTokens() {
  return SYNC_TOKEN_ENV_NAMES.map((name) => process.env[name]?.trim()).filter(
    (value): value is string => Boolean(value)
  );
}

export function primarySyncToken() {
  return configuredSyncTokens()[0] ?? "";
}

export function isAuthorizedSyncRequest(req: NextRequest) {
  const token = requestedSyncToken(req);
  if (!token) return false;
  return configuredSyncTokens().includes(token);
}

export function isAuthorizedCronRequest(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return false;
  return req.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export function syncTokenMissingMessage() {
  return "Token de sincronizacao nao configurado no servidor. Configure SHARED_SYNC_TOKEN ou GOOGLE_SHEETS_SYNC_TOKEN no Vercel.";
}
