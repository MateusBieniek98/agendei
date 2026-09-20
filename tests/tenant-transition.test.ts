import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createLegacyTenantContext,
  isTenantSchemaUnavailable,
  legacySingleTenantEnabled,
  resolveLoginAccess,
} from "@/lib/tenant-transition";
import type { Profile } from "@/lib/types";

const profile: Profile = {
  id: "538a6fc8-0125-4400-9e03-d43f26e22289",
  email: "admin@example.com",
  nome: "Admin",
  role: "admin",
  equipe_id: null,
  active_organization_id: null,
  ativo: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
};

function queryResult(result: { data: unknown; error: unknown }) {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => result,
  };
  return query;
}

function loginClient(
  results: Array<{ data: unknown; error: unknown }>,
  platformAdmin = false
) {
  let index = 0;
  return {
    from: () => queryResult(results[index++] ?? { data: null, error: null }),
    rpc: async () => ({ data: platformAdmin, error: null }),
  } as unknown as SupabaseClient;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("transição do schema multiempresa", () => {
  it("só habilita compatibilidade com flag explícita em desenvolvimento", () => {
    expect(
      legacySingleTenantEnabled({
        NODE_ENV: "development",
        ALLOW_LEGACY_SINGLE_TENANT: "true",
      })
    ).toBe(true);
    expect(
      legacySingleTenantEnabled({
        NODE_ENV: "production",
        ALLOW_LEGACY_SINGLE_TENANT: "true",
      })
    ).toBe(false);
    expect(legacySingleTenantEnabled({ NODE_ENV: "development" })).toBe(false);
  });

  it("reconhece apenas erros de ausência do schema tenant", () => {
    expect(
      isTenantSchemaUnavailable({
        code: "42703",
        message: "column profiles.active_organization_id does not exist",
      })
    ).toBe(true);
    expect(
      isTenantSchemaUnavailable({
        code: "42P01",
        message: 'relation "public.organization_members" does not exist',
      })
    ).toBe(true);
    expect(
      isTenantSchemaUnavailable({
        code: "42501",
        message: "permission denied for organization_members",
      })
    ).toBe(false);
    expect(
      isTenantSchemaUnavailable({
        code: "42703",
        message: "column profiles.nome does not exist",
      })
    ).toBe(false);
  });

  it("projeta o perfil legado em uma única organização local", () => {
    const tenant = createLegacyTenantContext(profile);

    expect(tenant.profile.role).toBe("admin");
    expect(tenant.profile.active_organization_id).toBe(tenant.organization.id);
    expect(tenant.organization.display_name).toBe("GN Silvicultura");
    expect(tenant.membership.active).toBe(true);
    expect(tenant.availableOrganizations).toHaveLength(1);
  });

  it("autoriza perfil legado ativo quando o schema tenant ainda não existe", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_LEGACY_SINGLE_TENANT", "true");
    const client = loginClient([
      {
        data: null,
        error: {
          code: "42703",
          message: "column profiles.active_organization_id does not exist",
        },
      },
      { data: { role: "admin", ativo: true }, error: null },
    ]);

    await expect(resolveLoginAccess(client, profile.id)).resolves.toEqual({
      ok: true,
      role: "admin",
      legacy: true,
    });
  });

  it("continua bloqueando erros de autorização mesmo com o modo legado ativo", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_LEGACY_SINGLE_TENANT", "true");
    const client = loginClient([
      {
        data: null,
        error: {
          code: "42501",
          message: "permission denied for profiles",
        },
      },
    ]);

    await expect(resolveLoginAccess(client, profile.id)).resolves.toEqual({
      ok: false,
      reason: "perfil",
    });
  });

  it("direciona administrador da plataforma sem exigir associação empresarial", async () => {
    const client = loginClient(
      [{ data: { active_organization_id: null, ativo: true }, error: null }],
      true
    );

    await expect(resolveLoginAccess(client, profile.id)).resolves.toEqual({
      ok: true,
      role: "admin",
      legacy: false,
      platformAdmin: true,
    });
  });
});
