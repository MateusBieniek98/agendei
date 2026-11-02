import { describe, expect, it } from "vitest";
import { PREVIEW_RECORDS, defaultPreviewFilters, filterPreviewRecords, summarizePreview, type PreviewRecord } from "@/lib/management-preview";

const base: PreviewRecord = {
  id: "example-1", competence: "2026-10", date: "2026-10-05", performedOn: "2026-10-05",
  farm: "Fazenda de teste A", plot: "T-01", person: "Equipe de teste", activity: "Plantio",
  unit: "ha", quantity: 2, value: 1000, pointed: 800, status: "Parcial", retroactive: false,
};
const records: PreviewRecord[] = [
  base,
  { ...base, id: "example-2", performedOn: "2026-09-28", value: 250, pointed: 250, quantity: 1, status: "Apontado", retroactive: true },
  { ...base, id: "example-3", farm: "Fazenda de teste B", activity: "Horas homem", unit: "h", quantity: 8, value: 100, pointed: 0, status: "Pendente" },
  { ...base, id: "other-month", competence: "2026-09", date: "2026-09-05", value: 9000 },
];

describe("prévia do painel de gestão", () => {
  it("reconcilia realizado, retroativos, apontado e saldo pendente", () => {
    const summary = summarizePreview(records, defaultPreviewFilters(), 2000);
    expect(summary.rows).toHaveLength(3);
    expect(summary.produced).toBe(1100);
    expect(summary.retroactive).toBe(250);
    expect(summary.total).toBe(1350);
    expect(summary.pointed).toBe(1050);
    expect(summary.pending).toBe(300);
    expect(summary.pointed + summary.pending).toBe(summary.total);
    expect(summary.produced + summary.retroactive).toBe(summary.total);
    expect(summary.progress).toBeCloseTo(55, 6);
  });

  it("não soma horas como hectares nem inclui retroativos no gráfico de realizado", () => {
    const summary = summarizePreview(records, defaultPreviewFilters(), 2000);
    expect(summary.area).toBe(2);
    expect(summary.activities.find((activity) => activity.name === "Horas homem")).toMatchObject({ unit: "h", quantity: 8 });
    expect(summary.series.find((point) => point.day === 5)).toMatchObject({ value: 1100, area: 2, cumulative: 1100 });
    expect(summary.series.find((point) => point.day === 28)?.cumulative).toBe(1100);
    expect(summary.series.find((point) => point.day === 29)?.cumulative).toBeNull();
  });

  it("combina filtros, inclui apontamentos parciais nas pendências e mantém a meta global", () => {
    const filters = { ...defaultPreviewFilters(), farm: base.farm, activity: "Plantio", person: base.person, status: "Pendente", from: "2026-10-05", to: "2026-10-05" };
    expect(filterPreviewRecords(records, filters).map((row) => row.id)).toEqual(["example-1"]);
    const summary = summarizePreview(records, filters, 2000);
    expect(summary.pending).toBe(200);
    expect(summary.target).toBe(2000);
    expect(summary.elapsedDays).toBe(1);
    expect(summary.pace).toBe(1000);
    expect(summary.projection).toBe(1000 * summary.monthDays);
  });

  it("respeita os limites inclusivos e a data de lançamento dos retroativos", () => {
    expect(filterPreviewRecords(records, { ...defaultPreviewFilters(), from: "2026-10-05", to: "2026-10-05" })).toHaveLength(3);
    expect(filterPreviewRecords(records, { ...defaultPreviewFilters(), from: "2026-10-06" })).toHaveLength(0);
    expect(filterPreviewRecords(records, { ...defaultPreviewFilters(), status: "Apontado" }).map((row) => row.id)).toEqual(["example-2"]);
    expect(filterPreviewRecords(records, { ...defaultPreviewFilters(), status: "Parcial" }).map((row) => row.id)).toEqual(["example-1"]);
  });

  it("retorna um estado vazio sem valores não finitos para datas invertidas e domingos", () => {
    for (const range of [{ from: "2026-10-20", to: "2026-10-01" }, { from: "2026-10-04", to: "2026-10-04" }]) {
      const summary = summarizePreview(records, { ...defaultPreviewFilters(), ...range }, 0);
      expect(summary.rows).toHaveLength(0);
      expect(summary.total).toBe(0);
      expect(summary.pace).toBe(0);
      expect(summary.progress).toBe(0);
      expect(Object.values(summary).filter((value) => typeof value === "number").every(Number.isFinite)).toBe(true);
    }
  });

  it("gera competências independentes, com identificadores únicos e rankings reconciliados", () => {
    expect(new Set(PREVIEW_RECORDS.map((row) => row.id)).size).toBe(PREVIEW_RECORDS.length);
    for (const month of ["2026-10", "2026-09"]) {
      const summary = summarizePreview(PREVIEW_RECORDS, defaultPreviewFilters(month), 425000);
      expect(summary.rows.length).toBeGreaterThan(100);
      expect(summary.rows.every((row) => row.competence === month && row.id.startsWith("demo-"))).toBe(true);
      expect(summary.farms.reduce((sum, group) => sum + group.value, 0)).toBeCloseTo(summary.total, 2);
      expect(summary.people.reduce((sum, group) => sum + group.value, 0)).toBeCloseTo(summary.total, 2);
      expect(summary.farms[0].value).toBeGreaterThanOrEqual(summary.farms[1].value);
    }
  });
});
