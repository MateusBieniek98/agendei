import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  resolveLoginAccess: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

vi.mock("@/lib/tenant-transition", () => ({
  resolveLoginAccess: mocks.resolveLoginAccess,
}));

import { POST } from "@/app/api/auth/login/route";

type CookieBatch = Array<{
  name: string;
  value: string;
  options: { path?: string; httpOnly?: boolean };
}>;

function request() {
  return new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    body: new URLSearchParams({
      email: "admin@staging.talhivo.invalid",
      senha: "secret",
    }),
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
}

function mockAuthenticatedClient() {
  mocks.createServerClient.mockImplementation(
    (
      _url: string,
      _key: string,
      options: {
        cookies: {
          setAll: (cookies: CookieBatch, headers: Record<string, string>) => void;
        };
      }
    ) => ({
      auth: {
        signInWithPassword: async () => {
          options.cookies.setAll(
            [
              {
                name: "sb-staging-auth-token.0",
                value: "chunk-zero",
                options: { path: "/", httpOnly: true },
              },
              {
                name: "sb-staging-auth-token.1",
                value: "chunk-one",
                options: { path: "/", httpOnly: true },
              },
            ],
            {
              "cache-control": "private, no-cache, no-store",
              pragma: "no-cache",
            }
          );

          return {
            data: {
              user: { id: "user-1" },
              session: { access_token: "access", refresh_token: "refresh" },
            },
            error: null,
          };
        },
      },
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://staging.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  mockAuthenticatedClient();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("rota de login", () => {
  it("confirma os cookies SSR antes de navegar para a area protegida", async () => {
    mocks.resolveLoginAccess.mockResolvedValue({ ok: true, role: "admin" });

    const response = await POST(request());
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("location")).toBeNull();
    expect(body).toContain('window.location.replace("/admin")');
    expect(body).toContain('content="0;url=/admin"');
    expect(response.headers.get("cache-control")).toBe(
      "private, no-cache, no-store"
    );
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.cookies.get("sb-staging-auth-token.0")?.value).toBe(
      "chunk-zero"
    );
    expect(response.cookies.get("sb-staging-auth-token.1")?.value).toBe(
      "chunk-one"
    );
  });

  it("nao grava sessao quando o usuario nao pertence a uma organizacao", async () => {
    mocks.resolveLoginAccess.mockResolvedValue({
      ok: false,
      reason: "organizacao",
    });

    const response = await POST(request());

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?erro=organizacao"
    );
    expect(response.cookies.getAll()).toHaveLength(0);
  });
});
