import { requireRole } from "@/lib/auth";
import TopBar from "@/components/nav/TopBar";
import LogoutButton from "@/components/nav/LogoutButton";
import MaintenanceNav from "@/components/maintenance/MaintenanceNav";
import { ToastProvider } from "@/components/ui/Toast";

export default async function MaintenanceLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(["manutencao"]);
  return (
    <ToastProvider>
      <div className="app-shell app-scroll-area">
        <TopBar title="Manutenção" subtitle={profile.nome} right={<LogoutButton />} />
        <MaintenanceNav />
        <main className="app-shell-main app-content-frame mx-auto w-full max-w-7xl overflow-x-clip px-3 py-4 sm:px-4 sm:py-6 md:px-6">{children}</main>
      </div>
    </ToastProvider>
  );
}
