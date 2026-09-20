import { NextResponse } from "next/server";
import { getPlatformApiContext } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const context = await getPlatformApiContext();
  if ("response" in context) return context.response;

  const { data: entries, error } = await context.admin
    .from("platform_audit_log")
    .select("id,actor_id,organization_id,action,details,created_at")
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const organizationIds = Array.from(
    new Set((entries ?? []).map((entry) => entry.organization_id).filter(Boolean))
  ) as string[];
  const actorIds = Array.from(
    new Set((entries ?? []).map((entry) => entry.actor_id).filter(Boolean))
  ) as string[];
  const [{ data: organizations }, { data: actors }] = await Promise.all([
    organizationIds.length
      ? context.admin.from("organizations").select("id,display_name").in("id", organizationIds)
      : Promise.resolve({ data: [] }),
    actorIds.length
      ? context.admin.from("profiles").select("id,nome,email").in("id", actorIds)
      : Promise.resolve({ data: [] }),
  ]);
  const organizationNames = new Map(
    (organizations ?? []).map((item) => [String(item.id), item.display_name])
  );
  const actorNames = new Map(
    (actors ?? []).map((item) => [String(item.id), item.nome || item.email])
  );

  return NextResponse.json({
    items: (entries ?? []).map((entry) => ({
      ...entry,
      organization_name: entry.organization_id
        ? organizationNames.get(String(entry.organization_id)) ?? "Empresa removida"
        : "Plataforma",
      actor_name: entry.actor_id
        ? actorNames.get(String(entry.actor_id)) ?? "Operador da plataforma"
        : "Sistema",
    })),
  });
}
