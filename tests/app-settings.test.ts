import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOGIN_SETTINGS,
  normalizeLoginSettings,
} from "@/lib/app-settings-shared";

describe("configuração da tela de entrada", () => {
  it("normaliza o novo formato simplificado", () => {
    expect(
      normalizeLoginSettings({
        brandName: "  GN Campo  ",
        instruction: "  Entre para continuar. ",
        footer: "  Uso interno ",
        buttonLabel: "  Acessar ",
      })
    ).toEqual({
      brandName: "GN Campo",
      instruction: "Entre para continuar.",
      footer: "Uso interno",
      buttonLabel: "Acessar",
    });
  });

  it("aproveita o antigo eyebrow como nome da marca", () => {
    expect(
      normalizeLoginSettings({
        eyebrow: "GN Silvicultura",
        title: "Texto antigo que não deve aparecer",
        subtitle: "Descrição antiga que não deve aparecer",
        footer: "GN",
        buttonLabel: "Entrar",
      })
    ).toEqual({
      brandName: "GN Silvicultura",
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
