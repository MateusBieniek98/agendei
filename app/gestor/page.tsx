// Server component fininho — só valida o role e renderiza o client
// dashboard que faz fetch via /api/dashboard com filtro de período.
import { requireRole } from "@/lib/auth";
import GestorDashboard from "./GestorDashboard";

export const dynamic = "force-dynamic";

export default async function GestorPage() {
  await requireRole(["gestor", "admin"]);
  return <GestorDashboard />;
}
