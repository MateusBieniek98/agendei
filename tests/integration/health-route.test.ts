import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("returns stable operational metadata without customer information", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, service: "Talhivo" });
    expect(body.timestamp).toEqual(expect.any(String));
    expect(Object.keys(body).sort()).toEqual(["ok", "service", "timestamp"]);
  });
});
