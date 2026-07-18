import AppShell from "@/components/nav/AppShell";
import { GESTOR_NAVIGATION } from "@/components/nav/navigation";
import { ToastProvider } from "@/components/ui/Toast";
import { requireGestorShellProfile } from "./access";

export default async function GestorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireGestorShellProfile();

  return (
    <ToastProvider>
      <AppShell
        navigation={GESTOR_NAVIGATION}
        user={{ nome: profile.nome, role: profile.role }}
        areaLabel="Gestão executiva"
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
