// Server component fininho — só valida o role e renderiza o client
// dashboard que faz fetch via /api/dashboard com filtro de período.
import { requireRole } from "@/lib/auth";
import GestorDashboard, { type GestorDashboardAba } from "./GestorDashboard";

export const dynamic = "force-dynamic";

type GestorPageProps = {
  searchParams: Promise<{ tab?: string | string[] }>;
};

const ABAS_VALIDAS: GestorDashboardAba[] = [
  "faturamento",
  "manutencao",
  "planejamento",
];

function normalizarTab(tab: string | string[] | undefined): GestorDashboardAba {
  const value = Array.isArray(tab) ? tab[0] : tab;
  return ABAS_VALIDAS.includes(value as GestorDashboardAba)
    ? (value as GestorDashboardAba)
    : "faturamento";
}

export default async function GestorPage({ searchParams }: GestorPageProps) {
  await requireRole(["gestor", "admin"]);
  const params = await searchParams;
  return <GestorDashboard initialAba={normalizarTab(params.tab)} />;
}
