import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { signOut } = vi.hoisted(() => ({
  signOut: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServer: vi.fn(async () => ({ auth: { signOut } })),
}));

import { GET, POST } from "@/app/api/auth/logout/route";

describe("logout route", () => {
  beforeEach(() => {
    signOut.mockReset();
    signOut.mockResolvedValue({ error: null });
  });

  it("rejects cross-origin requests", async () => {
    const request = new NextRequest("https://app.example.com/api/auth/logout", {
      method: "POST",
      headers: { origin: "https://malicious.example" },
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("signs out only the current device session", async () => {
    const request = new NextRequest("https://app.example.com/api/auth/logout", {
      method: "POST",
      headers: { origin: "https://app.example.com" },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("does not allow logout mutations over GET", async () => {
    const response = await GET();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });
});
