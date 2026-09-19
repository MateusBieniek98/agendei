import { PRODUCT_BRAND } from "@/lib/product-brand";

export type LoginSettings = {
  brandName: string;
  instruction: string;
  footer: string;
  buttonLabel: string;
};

export const LOGIN_SETTINGS_KEY = "login_content";

export const DEFAULT_LOGIN_SETTINGS: LoginSettings = {
  brandName: PRODUCT_BRAND.name,
  instruction: "Use seu e-mail corporativo para acessar.",
  footer: `${PRODUCT_BRAND.descriptor} · Acesso seguro`,
  buttonLabel: "Entrar",
};

function textOrDefault(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

export function normalizeLoginSettings(value: unknown): LoginSettings {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  return {
    brandName: DEFAULT_LOGIN_SETTINGS.brandName,
    instruction: textOrDefault(
      source.instruction,
      DEFAULT_LOGIN_SETTINGS.instruction
    ),
    footer: textOrDefault(source.footer, DEFAULT_LOGIN_SETTINGS.footer),
    buttonLabel: textOrDefault(
      source.buttonLabel,
      DEFAULT_LOGIN_SETTINGS.buttonLabel
    ),
  };
}
