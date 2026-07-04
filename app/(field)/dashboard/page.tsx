import { requireRole } from "@/lib/auth";
import AdminDashboard from "@/app/admin/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function FieldDashboardPage() {
  await requireRole(["encarregado"]);

  return (
    <AdminDashboard
      mode="encarregado"
      showExports={false}
      hideBottomNav
    />
  );
}
