import { describe, expect, it } from "vitest";
import {
  hasOnlyControlledInsumos,
  normalizeInsumoInput,
  optionalNumber,
  parseBulkImportedInsumos,
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

  it("mantém até seis insumos controlados no apontamento", () => {
    const rows = Array.from({ length: 7 }, (_, index) => ({
      insumo_id: `insumo-${index + 1}`,
      quantidade: index + 1,
    }));

    expect(sanitizeControlledInsumos(rows)).toHaveLength(6);
    expect(sanitizeControlledInsumos(rows)[5]).toEqual({
      insumo_id: "insumo-6",
      quantidade: 6,
    });
  });

  it("resolve os seis pares da importação em massa por código ou nome", () => {
    const catalog = Array.from({ length: 6 }, (_, index) => ({
      id: `id-${index + 1}`,
      codigo: `COD-${index + 1}`,
      nome: `Insumo ${index + 1}`,
      unidade: "kg",
      ativo: true,
    }));
    const values = Object.fromEntries(
      catalog.flatMap((item, index) => [
        [`insumo_${index + 1}`, index % 2 === 0 ? item.codigo : item.nome],
        [`quantidade_insumo_${index + 1}`, `${index + 1},5`],
      ])
    );

    const parsed = parseBulkImportedInsumos(values, catalog);

    expect(parsed).toHaveLength(6);
    expect(parsed[0]).toEqual({
      insumo_id: "id-1",
      nome: "Insumo 1",
      unidade: "kg",
      quantidade: 1.5,
    });
    expect(parsed[5].quantidade).toBe(6.5);
  });

  it("aceita menos de seis insumos e ignora os pares vazios", () => {
    const catalog = [{
      id: "id-1",
      codigo: "COD-1",
      nome: "Insumo 1",
      unidade: "kg",
      ativo: true,
    }];

    expect(parseBulkImportedInsumos({
      insumo_1: "COD-1",
      quantidade_insumo_1: "2,5",
      insumo_2: "",
      quantidade_insumo_2: "",
    }, catalog)).toEqual([{
      insumo_id: "id-1",
      nome: "Insumo 1",
      unidade: "kg",
      quantidade: 2.5,
    }]);
    expect(parseBulkImportedInsumos({}, catalog)).toEqual([]);
  });

  it("rejeita par incompleto ou insumo não cadastrado na importação", () => {
    const catalog = [{
      id: "id-1",
      codigo: "COD-1",
      nome: "Insumo 1",
      unidade: "kg",
      ativo: true,
    }];

    expect(() => parseBulkImportedInsumos({ insumo_1: "COD-1" }, catalog)).toThrow(
      "Quantidade do insumo 1 não informada."
    );
    expect(() => parseBulkImportedInsumos({ insumo_1: "INEXISTENTE", quantidade_insumo_1: "1" }, catalog)).toThrow(
      "Insumo 1 não encontrado: INEXISTENTE"
    );
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
