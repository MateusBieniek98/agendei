import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOGIN_SETTINGS,
  normalizeLoginSettings,
} from "@/lib/app-settings-shared";

describe("configuração global da tela de entrada", () => {
  it("usa Talhivo como identidade global padrão", () => {
    expect(DEFAULT_LOGIN_SETTINGS.brandName).toBe("Talhivo");
    expect(DEFAULT_LOGIN_SETTINGS.footer).toContain(
      "Gestão operacional florestal"
    );
  });

  it("mantém a marca global ao normalizar o conteúdo", () => {
    expect(
      normalizeLoginSettings({
        brandName: "  GN Campo  ",
        instruction: "  Entre para continuar. ",
        footer: "  Uso interno ",
        buttonLabel: "  Acessar ",
      })
    ).toEqual({
      brandName: DEFAULT_LOGIN_SETTINGS.brandName,
      instruction: "Entre para continuar.",
      footer: "Uso interno",
      buttonLabel: "Acessar",
    });
  });

  it("não restaura a marca antiga a partir do formato legado", () => {
    expect(
      normalizeLoginSettings({
        eyebrow: "GN Silvicultura",
        title: "Texto antigo que não deve aparecer",
        subtitle: "Descrição antiga que não deve aparecer",
        footer: "GN",
        buttonLabel: "Entrar",
      })
    ).toEqual({
      brandName: DEFAULT_LOGIN_SETTINGS.brandName,
      instruction: DEFAULT_LOGIN_SETTINGS.instruction,
      footer: "GN",
      buttonLabel: "Entrar",
    });
  });

  it("usa valores padrão quando o conteúdo é inválido ou vazio", () => {
    expect(
      normalizeLoginSettings({
        brandName: " ",
        instruction: null,
        footer: "",
        buttonLabel: 42,
      })
    ).toEqual(DEFAULT_LOGIN_SETTINGS);
  });
});
