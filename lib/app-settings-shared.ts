export type LoginSettings = {
  eyebrow: string;
  title: string;
  subtitle: string;
  footer: string;
  buttonLabel: string;
};

export const LOGIN_SETTINGS_KEY = "login_content";

export const DEFAULT_LOGIN_SETTINGS: LoginSettings = {
  eyebrow: "GN Silvicultura",
  title: "Gestao de producao no campo, sem friccao.",
  subtitle:
    "Lancamentos diarios, controle de maquinas e dashboards em tempo real para a operacao de silvicultura da GN.",
  footer: "GN - todos os direitos reservados.",
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
    eyebrow: textOrDefault(source.eyebrow, DEFAULT_LOGIN_SETTINGS.eyebrow),
    title: textOrDefault(source.title, DEFAULT_LOGIN_SETTINGS.title),
    subtitle: textOrDefault(source.subtitle, DEFAULT_LOGIN_SETTINGS.subtitle),
    footer: textOrDefault(source.footer, DEFAULT_LOGIN_SETTINGS.footer),
    buttonLabel: textOrDefault(
      source.buttonLabel,
      DEFAULT_LOGIN_SETTINGS.buttonLabel
    ),
  };
}
