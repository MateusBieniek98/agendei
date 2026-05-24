// Server component fininho — só valida o role e renderiza o client
// dashboard que faz fetch via /api/dashboard com filtro de período.
import { requireRole } from "@/lib/auth";
import GestorDashboard, { type GestorDashboardAba } from "./GestorDashboard";

export const dynamic = "force-dynamic";

type GestorPageProps = {
  searchParams: Promise<{ tab?: string | string[] }>;
};

const ABAS_VALIDAS: GestorDashboardAba[] = [
  "indicadores",
  "equipes",
  "manutencao",
  "planejamento",
  "faturamento",
];

function normalizarTab(tab: string | string[] | undefined): GestorDashboardAba {
  const value = Array.isArray(tab) ? tab[0] : tab;
  if (value === "faturamento") return "indicadores";
  return ABAS_VALIDAS.includes(value as GestorDashboardAba)
    ? (value as GestorDashboardAba)
    : "indicadores";
}

export default async function GestorPage({ searchParams }: GestorPageProps) {
  const profile = await requireRole(["gestor", "admin", "encarregado"]);
  const params = await searchParams;
  const requestedTab = normalizarTab(params.tab);
  const initialAba =
    profile.role === "encarregado" && requestedTab !== "equipes"
      ? "indicadores"
      : requestedTab;

  return (
    <GestorDashboard
      initialAba={initialAba}
      mostrarManutencao={profile.role !== "encarregado"}
      mostrarPlanejamento={profile.role !== "encarregado"}
    />
  );
}
