// Health check público — usado por monitoramento (UptimeRobot, etc.) e
// liberado no proxy.ts. Não toca no banco; apenas confirma que o app
// está respondendo.

import { NextResponse } from "next/server";
import { PRODUCT_BRAND } from "@/lib/product-brand";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: PRODUCT_BRAND.name,
    timestamp: new Date().toISOString(),
  });
}
