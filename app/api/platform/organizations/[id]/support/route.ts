import { NextResponse, type NextRequest } from "next/server";
import { getPlatformApiContext } from "@/lib/platform-admin";
import { consumeOrganizationRateLimit } from "@/lib/rate-limit";
import { logEvent } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

const SUPPORT_DURATIONS = new Set([30, 60, 120]);

export async function POST(request: NextRequest, routeContext: Context) {
  const context = await getPlatformApiContext();
  if ("response" in context) return context.response;

  const { id: organizationId } = await routeContext.params;
  const body = await request.json().catch(() => ({}));
  const reason = String(body.reason ?? "").trim();
  const durationMinutes = Number(body.duration_minutes ?? 60);

  if (reason.length < 8 || reason.length > 500) {
    return NextResponse.json(
      { error: "Informe um motivo entre 8 e 500 caracteres." },
      { status: 400 }
    );
  }
  if (!SUPPORT_DURATIONS.has(durationMinutes)) {
    return NextResponse.json({ error: "Duração de suporte inválida." }, { status: 400 });
  }

  const rateLimit = await consumeOrganizationRateLimit({
    organizationId,
    bucket: "platform.support.start",
    limit: 20,
    windowSeconds: 3600,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: rateLimit.error ?? "Limite de acessos de suporte atingido." },
      { status: 429 }
    );
  }

  const { data, error } = await context.admin.rpc(
    "begin_platform_support_session",
    {
      p_actor_id: context.user.id,
      p_organization_id: organizationId,
      p_reason: reason,
      p_duration_minutes: durationMinutes,
    }
  );
  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.code === "42501" ? 403 : 400 }
    );
  }

  const session = Array.isArray(data) ? data[0] : data;
  logEvent("info", "organization.support_started", {
    actorId: context.user.id,
    organizationId,
    durationMinutes,
  });

  return NextResponse.json({ item: session, next: "/admin" }, { status: 201 });
}
