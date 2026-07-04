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
      <div className="app-scroll-area with-bottom-nav bg-[var(--bg-page)]">
        <TopBar
          title="Gestor"
          subtitle={profile.nome}
          right={<LogoutButton />}
        />
        <main className="mx-auto max-w-7xl px-3 py-3 sm:px-4 sm:py-5 md:px-6">{children}</main>
      </div>
    </ToastProvider>
  );
}
