import { describe, expect, it } from "vitest";
import {
  normalizeBulkValue,
  parseBooleanPtBr,
  parseBulkText,
  parseDatePtBr,
  parseNumberPtBr,
} from "@/lib/bulk-import";

const columns = [
  { key: "nome", label: "Nome", required: true },
  { key: "unidade", label: "Unidade", required: true },
  { key: "valor", label: "Valor unitário" },
];

describe("bulk import helpers", () => {
  it("parses spreadsheet tabs with a header", () => {
    expect(parseBulkText("Nome\tUnidade\tValor unitário\nRoçada\tha\t12,50", columns)).toEqual([
      {
        id: "2-0",
        line: 2,
        values: { nome: "Roçada", unidade: "ha", valor: "12,50" },
      },
    ]);
  });

  it("uses column order when no header exists", () => {
    expect(parseBulkText("Roçada\tha\t12,50", columns)[0].values).toEqual({
      nome: "Roçada",
      unidade: "ha",
      valor: "12,50",
    });
  });

  it("normalizes common Brazilian values", () => {
    expect(normalizeBulkValue(" Manutenção ")).toBe("manutencao");
    expect(parseNumberPtBr("1.234,50")).toBe(1234.5);
    expect(parseBooleanPtBr("não")).toBe(false);
    expect(parseDatePtBr("18/07/2026")).toBe("2026-07-18");
    expect(parseDatePtBr("31/02/2026")).toBeNull();
  });
});
