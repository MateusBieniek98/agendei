import AppShell from "@/components/nav/AppShell";
import { GESTOR_NAVIGATION } from "@/components/nav/navigation";
import { ToastProvider } from "@/components/ui/Toast";
import { requireGestorShellProfile } from "./access";
import { getCurrentTenantContext } from "@/lib/auth";

export default async function GestorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireGestorShellProfile();
  const tenant = await getCurrentTenantContext();

  return (
    <ToastProvider>
      <AppShell
        navigation={GESTOR_NAVIGATION}
        user={{ nome: profile.nome, role: profile.role }}
        organization={{ id: tenant!.organization.id, displayName: tenant!.organization.display_name }}
        organizations={tenant!.availableOrganizations.map(({ organization }) => ({ id: organization.id, displayName: organization.display_name }))}
        areaLabel="Gestão executiva"
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
