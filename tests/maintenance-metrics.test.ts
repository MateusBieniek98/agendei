import { describe, expect, it } from "vitest";
import {
  calculateMaintenanceIndicators,
  maintenanceElapsedDays,
} from "@/lib/maintenance-metrics";

describe("maintenance metrics", () => {
  const now = new Date("2026-07-18T12:00:00.000Z");

  it("counts stopped days from request creation and groups active requests", () => {
    const openRows: Parameters<typeof calculateMaintenanceIndicators>[0] = [
      {
        id: "one",
        maquina_id: "machine-one",
        descricao: "Motor",
        status: "aberto",
        prioridade: "urgente",
        situacao_atual: "Aguardando peça",
        situacao_atualizada_em: "2026-07-17T12:00:00.000Z",
        parada_desde: "2026-07-08T12:00:00.000Z",
        created_at: "2026-07-08T12:00:00.000Z",
        maquinas: { nome: "Trator 1", identificador: "T-01" },
        responsavel: null,
      },
      {
        id: "two",
        maquina_id: "machine-two",
        descricao: "Hidráulico",
        status: "em_andamento",
        prioridade: "alta",
        situacao_atual: "Em diagnóstico",
        situacao_atualizada_em: "2026-07-18T08:00:00.000Z",
        parada_desde: "2026-07-17T12:00:00.000Z",
        created_at: "2026-07-17T12:00:00.000Z",
        maquinas: { nome: "Trator 2", identificador: null },
        responsavel: { nome: "Técnico" },
      },
    ];
    const result = calculateMaintenanceIndicators(openRows, [], now);

    expect(result.maquinas_paradas).toBe(2);
    expect(result.aguardando).toBe(1);
    expect(result.em_atendimento).toBe(1);
    expect(result.maior_tempo_aberto_dias).toBe(10);
    expect(result.faixas.acima_7_dias).toBe(1);
    expect(result.faixas.ate_2_dias).toBe(1);
    expect(result.paradas[0].maquina_nome).toBe("Trator 1");
  });

  it("calculates average downtime for resolved requests", () => {
    const resolvedRows: Parameters<typeof calculateMaintenanceIndicators>[1] = [
      { parada_desde: "2026-07-01T00:00:00Z", parada_ate: "2026-07-06T00:00:00Z", created_at: "2026-07-01T00:00:00Z", resolvido_em: "2026-07-06T00:00:00Z" },
      { parada_desde: "2026-07-10T00:00:00Z", parada_ate: "2026-07-11T00:00:00Z", created_at: "2026-07-10T00:00:00Z", resolvido_em: "2026-07-11T00:00:00Z" },
    ];
    const result = calculateMaintenanceIndicators([], resolvedRows, now);

    expect(result.resolvidos_30d).toBe(2);
    expect(result.tempo_medio_parado_dias).toBe(3);
  });

  it("never returns negative elapsed time", () => {
    expect(maintenanceElapsedDays("2026-07-19T00:00:00Z", null, now)).toBe(0);
  });
});
