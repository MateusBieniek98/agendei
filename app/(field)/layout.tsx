import { getCurrentTenantContext, requireRole } from "@/lib/auth";
import AppShell from "@/components/nav/AppShell";
import { FIELD_NAVIGATION } from "@/components/nav/navigation";
import { ToastProvider } from "@/components/ui/Toast";

export default async function FieldLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole(["encarregado", "admin"]);
  const tenant = await getCurrentTenantContext();

  return (
    <ToastProvider>
      <AppShell
        navigation={FIELD_NAVIGATION}
        user={{ nome: profile.nome, role: profile.role }}
        organization={{ id: tenant!.organization.id, displayName: tenant!.organization.display_name }}
        organizations={tenant!.availableOrganizations.map(({ organization }) => ({ id: organization.id, displayName: organization.display_name }))}
        areaLabel="Operação de campo"
        mobileStrategy="bottom"
        contentWidth="standard"
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
