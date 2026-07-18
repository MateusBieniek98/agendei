import { requireRole } from "@/lib/auth";
import AppShell from "@/components/nav/AppShell";
import { MAINTENANCE_NAVIGATION } from "@/components/nav/navigation";
import { ToastProvider } from "@/components/ui/Toast";

export default async function MaintenanceLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(["manutencao"]);
  return (
    <ToastProvider>
      <AppShell
        navigation={MAINTENANCE_NAVIGATION}
        user={{ nome: profile.nome, role: profile.role }}
        areaLabel="Manutenção"
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
