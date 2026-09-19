import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  maintenanceBypassAllowed,
  maintenanceModeEnabled,
  maintenancePathIsPublic,
} from "@/lib/maintenance-mode";

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ auth: { getUser } })),
}));

import { proxy } from "@/proxy";

const bypassToken = "maintenance-bypass-token-with-32-chars-minimum";

describe("maintenance mode", () => {
  beforeEach(() => {
    process.env.MAINTENANCE_MODE = "true";
    process.env.MAINTENANCE_BYPASS_TOKEN = bypassToken;
    getUser.mockReset();
    getUser.mockResolvedValue({ data: { user: null }, error: null });
  });

  afterEach(() => {
    delete process.env.MAINTENANCE_MODE;
    delete process.env.MAINTENANCE_BYPASS_TOKEN;
  });

  it("normalizes the flag and requires a strong exact bypass token", () => {
    expect(maintenanceModeEnabled("ON")).toBe(true);
    expect(maintenanceModeEnabled("false")).toBe(false);
    expect(maintenanceBypassAllowed(bypassToken, bypassToken)).toBe(true);
    expect(maintenanceBypassAllowed("wrong", bypassToken)).toBe(false);
    expect(maintenanceBypassAllowed("short", "short")).toBe(false);
  });

  it("keeps only operational public paths available", () => {
    expect(maintenancePathIsPublic("/manutencao-sistema")).toBe(true);
    expect(maintenancePathIsPublic("/api/health")).toBe(true);
    expect(maintenancePathIsPublic("/api/auth/logout")).toBe(true);
    expect(maintenancePathIsPublic("/admin")).toBe(false);
  });

  it("redirects pages without touching Supabase", async () => {
    const response = await proxy(new NextRequest("https://app.example.com/admin"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://app.example.com/manutencao-sistema",
    );
    expect(response.headers.get("retry-after")).toBe("300");
    expect(getUser).not.toHaveBeenCalled();
  });

  it("blocks API requests with a machine-readable 503", async () => {
    const response = await proxy(
      new NextRequest("https://app.example.com/api/producao", { method: "POST" }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: "maintenance_mode" });
    expect(getUser).not.toHaveBeenCalled();
  });

  it("allows the maintenance page and authorized smoke-test bypass", async () => {
    const maintenancePage = await proxy(
      new NextRequest("https://app.example.com/manutencao-sistema"),
    );
    expect(maintenancePage.status).toBe(200);
    expect(getUser).not.toHaveBeenCalled();

    const bypassed = await proxy(
      new NextRequest("https://app.example.com/admin", {
        headers: { "x-maintenance-bypass": bypassToken },
      }),
    );
    expect(bypassed.status).toBe(200);
    expect([...bypassed.headers.values()].join(" ")).not.toContain(bypassToken);
    expect(getUser).toHaveBeenCalledOnce();
  });
});
