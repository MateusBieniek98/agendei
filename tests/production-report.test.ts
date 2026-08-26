import { describe, expect, it } from "vitest";
import {
  buildProductionReport,
  buildWhatsAppShareUrl,
  isAreaProductionUnit,
} from "@/lib/production-report";

describe("production report", () => {
  it("gera o informativo completo de uma operação em hectares", () => {
    const report = buildProductionReport({
      eps: "GN Florestal",
      data: "2026-08-15",
      operacao: "3º pré-emergente",
      encarregado: "Renildo",
      equipe: "Frente Norte",
      fazenda: "Mãe Santa",
      talhao: "002-01",
      unidade: "ha",
      quantidadeRealizada: 33.31,
      quantidadeAcumulada: 58.31,
      areaTotalHa: 58.31,
      quantidadeRestante: 0,
      status: "Fechado",
      insumos: [
        { nome: "Fordor", quantidade: 2.4, unidade: "kg" },
        { nome: "Essense", quantidade: 16, unidade: "L" },
      ],
      observacoes: "Aplicação concluída.",
    });

    expect(report).toContain("📊 *APONTAMENTO*");
    expect(report).toContain("📅 *Data:* 15/08/2026");
    expect(report).toContain("▶️ *Área Total:* 58,31 ha");
    expect(report).toContain("✅ *Área Realizada:* 33,31 ha");
    expect(report).toContain("✳️ *Área Acumulada:* 58,31 ha");
    expect(report).toContain("⛔ *Área Restante:* 0 ha");
    expect(report).toContain("• Fordor: 2,4 kg");
    expect(report).toContain("*OBS:* Aplicação concluída.");
  });

  it("mantém o texto útil quando o apontamento ainda está offline", () => {
    const report = buildProductionReport({
      data: "2026-08-25",
      operacao: "Plantio",
      encarregado: "João",
      equipe: "Frente 1",
      fazenda: "Fazenda Sul",
      talhao: "10-A",
      unidade: "ha",
      quantidadeRealizada: 12,
      areaTotalHa: 20,
      status: "Pendente de sincronização",
      insumos: [],
    });

    expect(report).toContain("↔️ *Status:* Pendente de sincronização");
    expect(report).toContain("Nenhum insumo informado.");
    expect(report).toContain("*OBS:* Sem observações.");
    expect(report).not.toContain("Área Acumulada");
  });

  it("identifica unidades de área e monta uma URL segura do WhatsApp", () => {
    expect(isAreaProductionUnit("hectares")).toBe(true);
    expect(isAreaProductionUnit("m³")).toBe(false);
    expect(buildWhatsAppShareUrl("Ação: 10 ha")).toBe(
      "https://wa.me/?text=A%C3%A7%C3%A3o%3A%2010%20ha"
    );
  });
});
