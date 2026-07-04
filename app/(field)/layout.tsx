import { requireRole } from "@/lib/auth";
import TopBar from "@/components/nav/TopBar";
import BottomNav from "@/components/nav/BottomNav";
import LogoutButton from "@/components/nav/LogoutButton";
import { ToastProvider } from "@/components/ui/Toast";

export default async function FieldLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole(["encarregado", "admin"]);

  return (
    <ToastProvider>
      <div className="app-shell app-scroll-area with-bottom-nav">
        <TopBar
          title="Encarregado"
          subtitle={profile.nome}
          right={<LogoutButton />}
        />
        <main className="app-shell-main app-content-frame mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">{children}</main>
        <BottomNav viewType="encarregado" />
      </div>
    </ToastProvider>
  );
}
