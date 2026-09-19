import { getCurrentTenantContext, requireRole } from "@/lib/auth";
import AppShell from "@/components/nav/AppShell";
import { MAINTENANCE_NAVIGATION } from "@/components/nav/navigation";
import { ToastProvider } from "@/components/ui/Toast";

export default async function MaintenanceLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(["manutencao"]);
  const tenant = await getCurrentTenantContext();
  return (
    <ToastProvider>
      <AppShell
        navigation={MAINTENANCE_NAVIGATION}
        user={{ nome: profile.nome, role: profile.role }}
        organization={{ id: tenant!.organization.id, displayName: tenant!.organization.display_name }}
        organizations={tenant!.availableOrganizations.map(({ organization }) => ({ id: organization.id, displayName: organization.display_name }))}
        areaLabel="Manutenção"
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
