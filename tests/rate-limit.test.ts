import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseAdminClient } = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient,
}));

import { consumeOrganizationRateLimit } from "@/lib/rate-limit";

const request = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  bucket: "security.test",
  limit: 5,
  windowSeconds: 60,
};

describe("consumeOrganizationRateLimit", () => {
  beforeEach(() => {
    createSupabaseAdminClient.mockReset();
  });

  it("fails closed when the privileged client is unavailable", async () => {
    createSupabaseAdminClient.mockReturnValue(null);

    await expect(consumeOrganizationRateLimit(request)).resolves.toEqual({
      allowed: false,
      error: "Configuração do servidor indisponível.",
    });
  });

  it("passes the organization scope and limits to the database RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    createSupabaseAdminClient.mockReturnValue({ rpc });

    await expect(consumeOrganizationRateLimit(request)).resolves.toEqual({
      allowed: true,
      error: null,
    });
    expect(rpc).toHaveBeenCalledWith("consume_api_rate_limit", {
      p_organization_id: request.organizationId,
      p_bucket: request.bucket,
      p_limit: request.limit,
      p_window_seconds: request.windowSeconds,
    });
  });

  it("fails closed when the database refuses the request", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "rpc unavailable" },
    });
    createSupabaseAdminClient.mockReturnValue({ rpc });

    await expect(consumeOrganizationRateLimit(request)).resolves.toEqual({
      allowed: false,
      error: "rpc unavailable",
    });
  });
});
