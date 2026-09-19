import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL(
    "../supabase/migrations/20260919223458_harden_privileged_functions.sql",
    import.meta.url
  )
);
const migration = readFileSync(migrationPath, "utf8");

describe("privileged planning synchronization migration", () => {
  it("keeps the implementation private and unavailable to API roles", () => {
    expect(migration).toContain(
      "create or replace function private.sync_planejamento_progress"
    );
    expect(migration).toMatch(
      /revoke all on function private\.sync_planejamento_progress[\s\S]*from public, anon, authenticated, service_role;/
    );
  });

  it("requires a service token or an active authenticated profile", () => {
    expect(migration).toContain("v_actor uuid := auth.uid()");
    expect(migration).toContain("v_jwt_role <> 'service_role'");
    expect(migration).toMatch(/where id = v_actor\s+and ativo = true/);
  });

  it("allows only authenticated and service roles to call the public RPC", () => {
    expect(migration).toMatch(
      /revoke all on function public\.sync_planejamento_progress[\s\S]*from public, anon, authenticated, service_role;/
    );
    expect(migration).toMatch(
      /grant execute on function public\.sync_planejamento_progress[\s\S]*to authenticated, service_role;/
    );
  });

  it("routes the database trigger through the private implementation", () => {
    const triggerFunction = migration.slice(
      migration.indexOf(
        "create or replace function public.sync_planejamento_progress_after_producao"
      )
    );

    expect(triggerFunction).toContain(
      "perform private.sync_planejamento_progress"
    );
    expect(triggerFunction).not.toContain(
      "perform public.sync_planejamento_progress"
    );
  });
});
