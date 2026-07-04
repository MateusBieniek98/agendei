import { requireRole } from "@/lib/auth";
import TopBar from "@/components/nav/TopBar";
import LogoutButton from "@/components/nav/LogoutButton";
import { ToastProvider } from "@/components/ui/Toast";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole(["admin"]);

  return (
    <ToastProvider>
      <div className="app-scroll-area with-bottom-nav" style={{ background: "var(--bg-page)" }}>
        <TopBar title="Admin" subtitle={profile.nome} right={<LogoutButton />} />
        <main
          className="mx-auto w-full max-w-7xl overflow-x-clip px-3 py-3 sm:px-4 sm:py-5 md:px-6"
          style={{ color: "var(--text-primary)" }}
        >
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
