import { describe, expect, it } from "vitest";
import {
  hasOnlyControlledInsumos,
  normalizeInsumoInput,
  optionalNumber,
  sanitizeControlledInsumos,
  sanitizeInsumos,
} from "@/lib/insumos";

describe("insumos", () => {
  it("normaliza itens do catálogo por código e exibição", () => {
    expect(normalizeInsumoInput("90000746")).toBe("HERBICIDA SUNWARD 5KG");
    expect(normalizeInsumoInput("90000746 · HERBICIDA SUNWARD 5KG")).toBe(
      "HERBICIDA SUNWARD 5KG"
    );
  });

  it("descarta quantidades inválidas no formato legado", () => {
    expect(
      sanitizeInsumos([
        { nome: "MAP", quantidade: "2.5", unidade: "kg" },
        { nome: "GEL", quantidade: 0 },
        { nome: "", quantidade: 3 },
      ])
    ).toEqual([
      {
        insumo_id: undefined,
        id: undefined,
        codigo: null,
        nome: "MAP",
        unidade: "kg",
        quantidade: 2.5,
      },
    ]);
  });

  it("consolida insumos controlados duplicados antes do RPC", () => {
    expect(
      sanitizeControlledInsumos([
        { insumo_id: " a ", quantidade: 1 },
        { id: "a", quantidade: "2.5" },
        { insumo_id: "b", quantidade: -1 },
      ])
    ).toEqual([{ insumo_id: "a", quantidade: 3.5 }]);
  });

  it("distingue carga controlada de histórico legado", () => {
    expect(hasOnlyControlledInsumos([{ insumo_id: "a", quantidade: 1 }])).toBe(true);
    expect(hasOnlyControlledInsumos([{ nome: "MAP", quantidade: 1 }])).toBe(false);
    expect(hasOnlyControlledInsumos([{ nome: "MAP", quantidade: 0 }])).toBe(true);
  });

  it("trata campo numérico opcional sem converter vazio em zero", () => {
    expect(optionalNumber("")).toBeNull();
    expect(optionalNumber("12.5")).toBe(12.5);
    expect(optionalNumber("abc")).toBeNull();
  });
});
