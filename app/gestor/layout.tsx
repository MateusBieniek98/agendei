import TopBar from "@/components/nav/TopBar";
import LogoutButton from "@/components/nav/LogoutButton";
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
      <div className="app-shell app-scroll-area with-bottom-nav">
        <TopBar
          title="Gestor"
          subtitle={profile.nome}
          right={<LogoutButton />}
        />
        <main className="app-shell-main app-content-frame mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6 md:px-6">{children}</main>
      </div>
    </ToastProvider>
  );
}
