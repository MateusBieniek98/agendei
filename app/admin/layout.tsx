import { requireRole } from "@/lib/auth";
import AppShell from "@/components/nav/AppShell";
import { ADMIN_NAVIGATION } from "@/components/nav/navigation";
import { ToastProvider } from "@/components/ui/Toast";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole(["admin"]);

  return (
    <ToastProvider>
      <AppShell
        navigation={ADMIN_NAVIGATION}
        user={{ nome: profile.nome, role: profile.role }}
        areaLabel="Administração"
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
