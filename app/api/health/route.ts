// Health check público — usado por monitoramento (UptimeRobot, etc.) e
// liberado no proxy.ts. Não toca no banco; apenas confirma que o app
// está respondendo.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "GN Silvicultura",
    timestamp: new Date().toISOString(),
  });
}
