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
      <div className="app-scroll-area with-bottom-nav" style={{ background: "var(--bg-page)" }}>
        <TopBar
          title="Encarregado"
          subtitle={profile.nome}
          right={<LogoutButton />}
        />
        <main className="mx-auto max-w-5xl px-3 py-3 sm:px-4 sm:py-5">{children}</main>
        <BottomNav viewType="encarregado" />
      </div>
    </ToastProvider>
  );
}
