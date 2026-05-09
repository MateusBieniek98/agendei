import type { NextRequest } from "next/server";

const SYNC_TOKEN_ENV_NAMES = ["SHARED_SYNC_TOKEN"] as const;

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

export function isAuthorizedSyncRequest(req: NextRequest) {
  const token = requestedSyncToken(req);
  if (!token) return false;
  return configuredSyncTokens().includes(token);
}

export function syncTokenMissingMessage() {
  return "SHARED_SYNC_TOKEN nao configurado no servidor. Configure SHARED_SYNC_TOKEN no Vercel.";
}
