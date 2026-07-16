import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/sync-auth";

const originalCronSecret = process.env.CRON_SECRET;

afterEach(() => {
  if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalCronSecret;
});

describe("autenticação do cron", () => {
  it("aceita apenas o Bearer exato configurado pela Vercel", () => {
    process.env.CRON_SECRET = "cron-secret-test";

    const authorized = new NextRequest("https://example.com/retry", {
      headers: { authorization: "Bearer cron-secret-test" },
    });
    const unauthorized = new NextRequest("https://example.com/retry", {
      headers: { authorization: "Bearer outro-token" },
    });

    expect(isAuthorizedCronRequest(authorized)).toBe(true);
    expect(isAuthorizedCronRequest(unauthorized)).toBe(false);
  });

  it("permanece fechado quando CRON_SECRET não existe", () => {
    delete process.env.CRON_SECRET;
    const request = new NextRequest("https://example.com/retry", {
      headers: { authorization: "Bearer qualquer" },
    });
    expect(isAuthorizedCronRequest(request)).toBe(false);
  });
});
