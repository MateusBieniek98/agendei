import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServer: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  supportSession: null as Record<string, unknown> | null,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <T,>(fn: T) => fn };
});
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServer: mocks.createSupabaseServer,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

import { getCurrentTenantContext } from "@/lib/auth";

const actorId = "8a9b6a07-6460-4f2c-b531-3308e3291753";
const organizationId = "4daa17ce-e297-48b2-ab2a-84170e73f267";
const organization = {
  id: organizationId,
  slug: "gn",
  display_name: "GN",
  legal_name: "GN",
  document_number: null,
  status: "active",
  plan_code: "founder",
  user_limit: 30,
  billing_email: null,
  contract_started_at: null,
  contract_ends_at: null,
  suspended_reason: null,
  created_at: "2026-09-20T00:00:00.000Z",
  updated_at: "2026-09-20T00:00:00.000Z",
};
const profile = {
  id: actorId,
  email: "platform-admin@staging.talhivo.invalid",
  nome: "Administrador da plataforma",
  role: "encarregado",
  ativo: true,
  equipe_id: null,
  active_organization_id: organizationId,
};
const legacyMembership = {
  organization_id: organizationId,
  user_id: actorId,
  role: "encarregado",
  equipe_id: null,
  active: true,
  invited_by: null,
  joined_at: "2026-09-20T00:00:00.000Z",
  created_at: "2026-09-20T00:00:00.000Z",
  updated_at: "2026-09-20T00:00:00.000Z",
  organizations: organization,
};

function chain(result: { data: unknown; error?: unknown }, terminal: "order" | "maybeSingle") {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "gt", "limit"]) {
    query[method] = vi.fn(() => query);
  }
  query.order = vi.fn(() =>
    terminal === "order" ? Promise.resolve(result) : query
  );
  query.maybeSingle = vi.fn(async () => result);
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.supportSession = {
    id: "support-session-1",
    organization_id: organizationId,
    reason: "Chamado solicitado pela empresa",
    started_at: "2026-09-20T12:00:00.000Z",
    expires_at: "2026-09-20T13:00:00.000Z",
  };

  mocks.createSupabaseServer.mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: actorId } } })) },
    rpc: vi.fn(async () => ({ data: true, error: null })),
    from: vi.fn((table: string) => {
      if (table === "profiles") return chain({ data: profile }, "maybeSingle");
      if (table === "organization_members") {
        return chain({ data: [legacyMembership], error: null }, "order");
      }
      throw new Error(`Tabela inesperada: ${table}`);
    }),
  });

  mocks.createSupabaseAdminClient.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === "platform_support_sessions") {
        return chain({ data: mocks.supportSession }, "maybeSingle");
      }
      if (table === "organizations") return chain({ data: organization }, "maybeSingle");
      if (table === "organization_settings") return chain({ data: null }, "maybeSingle");
      throw new Error(`Tabela administrativa inesperada: ${table}`);
    }),
  });
});

describe("contexto temporário do administrador da plataforma", () => {
  it("projeta papel admin mesmo quando existe associação legada inferior", async () => {
    const context = await getCurrentTenantContext();

    expect(context?.membership.role).toBe("admin");
    expect(context?.profile.role).toBe("admin");
    expect(context?.organization.id).toBe(organizationId);
    expect(context?.supportSession?.id).toBe("support-session-1");
    expect(context?.availableOrganizations).toHaveLength(1);
  });

  it("não usa a associação legada depois que o suporte termina", async () => {
    mocks.supportSession = null;

    await expect(getCurrentTenantContext()).resolves.toBeNull();
  });
});
