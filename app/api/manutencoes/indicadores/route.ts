import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { getMaintenanceIndicators } from "@/lib/maintenance-metrics";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!["admin", "gestor", "manutencao"].includes(profile.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const indicadores = await getMaintenanceIndicators(await createSupabaseServer());
    return NextResponse.json(
      { indicadores },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
