// Server component fininho — só valida o role e renderiza o client
// dashboard que faz fetch via /api/dashboard com filtro de período.
import { requireRole } from "@/lib/auth";
import AdminDashboard from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireRole(["admin"]);
  return <AdminDashboard />;
}
