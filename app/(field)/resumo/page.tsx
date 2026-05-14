import GestorDashboard from "@/app/gestor/GestorDashboard";

export const dynamic = "force-dynamic";

export default function ResumoFieldPage() {
  return <GestorDashboard mostrarManutencao={false} mostrarPlanejamento={false} />;
}
