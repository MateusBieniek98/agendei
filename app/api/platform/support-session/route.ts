import { NextResponse } from "next/server";
import { getPlatformApiContext } from "@/lib/platform-admin";
import { logEvent } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE() {
  const context = await getPlatformApiContext();
  if ("response" in context) return context.response;

  const { data, error } = await context.admin.rpc(
    "end_platform_support_session",
    {
      p_actor_id: context.user.id,
      p_reason: "encerrada_pelo_operador",
    }
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const session = Array.isArray(data) ? data[0] : data;
  logEvent("info", "organization.support_ended", {
    actorId: context.user.id,
    organizationId:
      session && typeof session === "object" && "organization_id" in session
        ? String(session.organization_id)
        : undefined,
  });

  return NextResponse.json({ ok: true, next: "/platform" });
}
