import { NextResponse, type NextRequest } from "next/server";
import { retryPendingApontamentosSheetSyncJobs } from "@/lib/google-sheets-apontamentos";
import {
  configuredSyncTokens,
  isAuthorizedCronRequest,
  isAuthorizedSyncRequest,
  syncTokenMissingMessage,
} from "@/lib/sync-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

async function handle(req: NextRequest) {
  const hasSyncToken = configuredSyncTokens().length > 0;
  const hasCronSecret = Boolean(process.env.CRON_SECRET?.trim());

  if (!hasSyncToken && !hasCronSecret) {
    return NextResponse.json(
      {
        error: `${syncTokenMissingMessage()} Configure tambem CRON_SECRET para o agendamento da Vercel.`,
      },
      { status: 500 }
    );
  }

  if (!isAuthorizedSyncRequest(req) && !isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limit = Math.min(
    Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 25), 1),
    100
  );
  const result = await retryPendingApontamentosSheetSyncJobs(limit);
  return NextResponse.json(result, {
    status: result.ok ? 200 : 500,
    headers: { "cache-control": "no-store" },
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
