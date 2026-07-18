import { requireRole } from "@/lib/auth";
import AppShell from "@/components/nav/AppShell";
import { FIELD_NAVIGATION } from "@/components/nav/navigation";
import { ToastProvider } from "@/components/ui/Toast";

export default async function FieldLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole(["encarregado", "admin"]);

  return (
    <ToastProvider>
      <AppShell
        navigation={FIELD_NAVIGATION}
        user={{ nome: profile.nome, role: profile.role }}
        areaLabel="Operação de campo"
        mobileStrategy="bottom"
        contentWidth="standard"
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
