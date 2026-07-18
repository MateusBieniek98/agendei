import AdminDashboard from "@/app/admin/AdminDashboard";
import type { DashboardSection } from "@/components/dashboard/DashboardSectionTabs";

export type GestorDashboardAba =
  | DashboardSection
  | "faturamento";

type GestorDashboardProps = {
  initialAba?: GestorDashboardAba;
  mostrarManutencao?: boolean;
  mostrarPlanejamento?: boolean;
};

function mapInitialTab(aba: GestorDashboardAba | undefined): DashboardSection {
  if (aba === "faturamento") return "indicadores";
  if (aba === "equipes" || aba === "manutencao" || aba === "planejamento") return aba;
  return "indicadores";
}

export default function GestorDashboard({
  initialAba = "indicadores",
  mostrarManutencao = true,
  mostrarPlanejamento = true,
}: GestorDashboardProps) {
  return (
    <AdminDashboard
      mode={mostrarManutencao || mostrarPlanejamento ? "gestor" : "encarregado"}
      showExports={false}
      initialTab={mapInitialTab(initialAba)}
    />
  );
}
