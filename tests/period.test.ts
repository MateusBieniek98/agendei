import { describe, expect, it } from "vitest";
import {
  cicloAnterior,
  cicloProducao,
  dataOperacionalISO,
  diasUteisPeriodo,
  periodoCustom,
} from "@/lib/period";

describe("calendário operacional", () => {
  it("usa o fuso de Campo Grande no limite do dia UTC", () => {
    expect(dataOperacionalISO(new Date("2026-07-21T02:30:00.000Z"))).toBe("2026-07-20");
    expect(dataOperacionalISO(new Date("2026-07-21T04:30:00.000Z"))).toBe("2026-07-21");
  });

  it("fecha ciclos inclusivos do dia 21 ao dia 20", () => {
    expect(cicloProducao(new Date("2026-07-16T15:00:00.000Z"))).toMatchObject({
      de: "2026-06-21",
      ate: "2026-07-20",
      diasTotais: 30,
    });
    expect(cicloAnterior(new Date("2026-07-16T15:00:00.000Z"))).toMatchObject({
      de: "2026-05-21",
      ate: "2026-06-20",
    });
  });

  it("considera apenas os dois primeiros sábados como úteis", () => {
    expect(diasUteisPeriodo(periodoCustom("2026-07-01", "2026-07-31"))).toBe(25);
  });
});
