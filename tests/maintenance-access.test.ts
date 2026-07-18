import { describe, expect, it } from "vitest";
import { maintenanceCapabilities } from "@/lib/maintenance-social";
import { defaultRouteForRole, safeReturnPath } from "@/lib/navigation";

describe("maintenance access", () => {
  it("sends the maintenance role to its own workspace", () => {
    expect(defaultRouteForRole("manutencao")).toBe("/manutencao");
  });

  it("preserva apenas destinos internos seguros após o login", () => {
    expect(safeReturnPath("/manutencao?tab=fila")).toBe("/manutencao?tab=fila");
    expect(safeReturnPath("https://example.com")).toBeNull();
    expect(safeReturnPath("//example.com")).toBeNull();
    expect(safeReturnPath("/login")).toBeNull();
  });

  it("lets a technician claim and prioritize an open request", () => {
    const permissions = maintenanceCapabilities(
      { id: "tech-1", role: "manutencao" },
      { status: "aberto", responsavel_id: null }
    );
    expect(permissions.can_claim).toBe(true);
    expect(permissions.can_assign).toBe(true);
    expect(permissions.can_prioritize).toBe(true);
    expect(permissions.can_resolve).toBe(false);
  });

  it("only lets the assigned technician conclude an active request", () => {
    expect(
      maintenanceCapabilities(
        { id: "tech-1", role: "manutencao" },
        { status: "em_andamento", responsavel_id: "tech-1" }
      ).can_resolve
    ).toBe(true);
    expect(
      maintenanceCapabilities(
        { id: "tech-2", role: "manutencao" },
        { status: "em_andamento", responsavel_id: "tech-1" }
      ).can_resolve
    ).toBe(false);
  });

  it("keeps field and manager profiles out of operational actions", () => {
    for (const role of ["encarregado", "gestor"] as const) {
      const permissions = maintenanceCapabilities(
        { id: role, role },
        { status: "em_andamento", responsavel_id: role }
      );
      expect(permissions.can_assign).toBe(false);
      expect(permissions.can_prioritize).toBe(false);
      expect(permissions.can_resolve).toBe(false);
    }
  });
});
