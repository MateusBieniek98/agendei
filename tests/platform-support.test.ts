import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPlatformApiContext: vi.fn(),
  consumeOrganizationRateLimit: vi.fn(),
  logEvent: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/platform-admin", () => ({
  getPlatformApiContext: mocks.getPlatformApiContext,
}));
vi.mock("@/lib/rate-limit", () => ({
  consumeOrganizationRateLimit: mocks.consumeOrganizationRateLimit,
}));
vi.mock("@/lib/logger", () => ({ logEvent: mocks.logEvent }));

import { POST } from "@/app/api/platform/organizations/[id]/support/route";
import { DELETE } from "@/app/api/platform/support-session/route";

const organizationId = "d05d6211-6a2b-4c2b-9876-4e2c3c52b255";
const actorId = "00c0e185-42b3-431d-a3d1-870ef96c4b87";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPlatformApiContext.mockResolvedValue({
    admin: { rpc: mocks.rpc },
    user: { id: actorId },
  });
  mocks.consumeOrganizationRateLimit.mockResolvedValue({
    allowed: true,
    error: null,
  });
  mocks.rpc.mockResolvedValue({
    data: { id: "support-1", organization_id: organizationId },
    error: null,
  });
});

describe("acesso temporário de suporte", () => {
  it("inicia uma sessão auditável para a empresa solicitada", async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/platform/organizations/${organizationId}/support`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reason: "Chamado 1042 aberto pelo cliente",
          duration_minutes: 60,
        }),
      }
    );

    const response = (await POST(request, {
      params: Promise.resolve({ id: organizationId }),
    }))!;

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ next: "/admin" });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "begin_platform_support_session",
      {
        p_actor_id: actorId,
        p_organization_id: organizationId,
        p_reason: "Chamado 1042 aberto pelo cliente",
        p_duration_minutes: 60,
      }
    );
  });

  it("rejeita motivo insuficiente antes de tocar o banco", async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/platform/organizations/${organizationId}/support`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "teste", duration_minutes: 60 }),
      }
    );

    const response = (await POST(request, {
      params: Promise.resolve({ id: organizationId }),
    }))!;

    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("propaga o bloqueio de MFA da autorização central", async () => {
    mocks.getPlatformApiContext.mockResolvedValue({
      response: NextResponse.json(
        { error: "mfa_required", next: "/seguranca/mfa" },
        { status: 403 }
      ),
    });
    const request = new NextRequest(
      `http://localhost:3000/api/platform/organizations/${organizationId}/support`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "Chamado de suporte válido" }),
      }
    );

    const response = (await POST(request, {
      params: Promise.resolve({ id: organizationId }),
    }))!;

    expect(response.status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("encerra a sessão e retorna ao ambiente global", async () => {
    const response = (await DELETE())!;

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      next: "/platform",
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "end_platform_support_session",
      {
        p_actor_id: actorId,
        p_reason: "encerrada_pelo_operador",
      }
    );
  });
});
