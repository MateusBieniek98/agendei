import { requireRole } from "@/lib/auth";
import TopBar from "@/components/nav/TopBar";
import LogoutButton from "@/components/nav/LogoutButton";
import AdminToolsNav from "@/components/nav/AdminToolsNav";
import { ToastProvider } from "@/components/ui/Toast";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole(["admin"]);

  return (
    <ToastProvider>
      <div className="app-shell app-scroll-area with-bottom-nav">
        <TopBar title="Admin" subtitle={profile.nome} right={<LogoutButton />} />
        <AdminToolsNav />
        <main
          className="app-shell-main app-content-frame mx-auto w-full max-w-7xl overflow-x-clip px-3 py-4 sm:px-4 sm:py-6 md:px-6"
          style={{ color: "var(--text-primary)" }}
        >
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
