import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServer: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  getUser: vi.fn(),
  listFactors: vi.fn(),
  deleteFactor: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServer: mocks.createSupabaseServer,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

import { DELETE } from "@/app/api/auth/mfa/enrollment/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createSupabaseServer.mockResolvedValue({
    auth: { getUser: mocks.getUser },
  });
  mocks.createSupabaseAdminClient.mockReturnValue({
    auth: {
      admin: {
        mfa: {
          listFactors: mocks.listFactors,
          deleteFactor: mocks.deleteFactor,
        },
      },
    },
  });
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "00c0e185-42b3-431d-a3d1-870ef96c4b87" } },
    error: null,
  });
  mocks.listFactors.mockResolvedValue({
    data: {
      factors: [
        { id: "factor-incomplete", factor_type: "totp", status: "unverified" },
        { id: "factor-active", factor_type: "totp", status: "verified" },
        { id: "factor-phone", factor_type: "phone", status: "unverified" },
      ],
    },
    error: null,
  });
  mocks.deleteFactor.mockResolvedValue({ data: { id: "factor-incomplete" }, error: null });
});

describe("reinício do cadastro MFA", () => {
  it("remove somente fatores TOTP incompletos do próprio usuário", async () => {
    const response = await DELETE();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, removed: 1 });
    expect(mocks.deleteFactor).toHaveBeenCalledTimes(1);
    expect(mocks.deleteFactor).toHaveBeenCalledWith({
      userId: "00c0e185-42b3-431d-a3d1-870ef96c4b87",
      id: "factor-incomplete",
    });
  });

  it("não usa a chave administrativa sem sessão autenticada", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await DELETE();

    expect(response.status).toBe(401);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });
});
