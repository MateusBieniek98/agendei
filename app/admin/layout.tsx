import { getCurrentTenantContext, requireRole } from "@/lib/auth";
import AppShell from "@/components/nav/AppShell";
import { ADMIN_NAVIGATION } from "@/components/nav/navigation";
import { ToastProvider } from "@/components/ui/Toast";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole(["admin"]);
  const tenant = await getCurrentTenantContext();

  return (
    <ToastProvider>
      <AppShell
        navigation={ADMIN_NAVIGATION}
        user={{ nome: profile.nome, role: profile.role }}
        organization={{ id: tenant!.organization.id, displayName: tenant!.organization.display_name }}
        organizations={tenant!.availableOrganizations.map(({ organization }) => ({ id: organization.id, displayName: organization.display_name }))}
        areaLabel="Administração"
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
