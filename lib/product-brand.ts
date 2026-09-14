export const PRODUCT_BRAND = {
  name: process.env.NEXT_PUBLIC_PRODUCT_NAME?.trim() || "Talhivo",
  shortName: process.env.NEXT_PUBLIC_PRODUCT_SHORT_NAME?.trim() || "Talhivo",
  descriptor: "Gestão operacional florestal",
  description:
    process.env.NEXT_PUBLIC_PRODUCT_DESCRIPTION?.trim() ||
    "A operação florestal sob controle, do campo à gestão.",
  supportEmail:
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "",
  privacyEmail:
    process.env.NEXT_PUBLIC_PRIVACY_EMAIL?.trim() || "",
  tagline: "Do campo à gestão.",
  colors: {
    pine: "#173f35",
    forest: "#2f7455",
    graphite: "#18211f",
    mist: "#f3f5f2",
    amber: "#d6a23a",
  },
  // Chave técnica estável: trocar este prefixo apagaria preferências e filas locais.
  localStoragePrefix: "forestry-ops",
} as const;
