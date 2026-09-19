import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("returns only public operational metadata", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.service).toBe("GN Silvicultura");
    expect(body.timestamp).toEqual(expect.any(String));
    expect(Object.keys(body).sort()).toEqual(["ok", "service", "timestamp"]);
  });
});
