import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPlatformApiContext: vi.fn(),
  logEvent: vi.fn(),
  from: vi.fn(),
  organizationInsert: vi.fn(),
  settingsInsert: vi.fn(),
  auditInsert: vi.fn(),
}));

vi.mock("@/lib/platform-admin", () => ({
  getPlatformApiContext: mocks.getPlatformApiContext,
}));
vi.mock("@/lib/logger", () => ({ logEvent: mocks.logEvent }));

import { POST } from "@/app/api/platform/organizations/route";

const actorId = "8a9b6a07-6460-4f2c-b531-3308e3291753";
const organizationId = "4daa17ce-e297-48b2-ab2a-84170e73f267";

function request(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/platform/organizations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.organizationInsert.mockImplementation((payload) => ({
    select: () => ({
      single: async () => ({
        data: {
          id: organizationId,
          ...payload,
          created_at: "2026-09-20T00:00:00.000Z",
          updated_at: "2026-09-20T00:00:00.000Z",
        },
        error: null,
      }),
    }),
  }));
  mocks.settingsInsert.mockResolvedValue({ error: null });
  mocks.auditInsert.mockResolvedValue({ error: null });
  mocks.from.mockImplementation((table: string) => {
    if (table === "organizations") return { insert: mocks.organizationInsert };
    if (table === "organization_settings") return { insert: mocks.settingsInsert };
    if (table === "platform_audit_log") return { insert: mocks.auditInsert };
    throw new Error(`Tabela inesperada: ${table}`);
  });
  mocks.getPlatformApiContext.mockResolvedValue({
    admin: { from: mocks.from },
    user: { id: actorId },
  });
});

describe("cadastro global de empresas", () => {
  it("cria empresa e configuração regional pelo console", async () => {
    const response = (await POST(request({
      display_name: "Empresa Florestal",
      legal_name: "Empresa Florestal Ltda.",
      user_limit: 25,
      timezone: "America/Campo_Grande",
      locale: "pt-BR",
    })))!;

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      item: { id: organizationId, slug: "empresa-florestal" },
      onboarding: null,
    });
    expect(mocks.organizationInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        display_name: "Empresa Florestal",
        slug: "empresa-florestal",
        user_limit: 25,
        created_by: actorId,
      })
    );
    expect(mocks.settingsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: organizationId,
        operational_name: "Empresa Florestal",
        timezone: "America/Campo_Grande",
        locale: "pt-BR",
      })
    );
    expect(mocks.auditInsert).toHaveBeenCalledOnce();
  });

  it("rejeita e-mail inválido antes de alterar o banco", async () => {
    const response = (await POST(request({
      display_name: "Empresa Florestal",
      admin_email: "email-invalido",
    })))!;

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "E-mail do administrador inválido.",
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
