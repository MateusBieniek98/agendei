import { requireRole } from "@/lib/auth";
import TopBar from "@/components/nav/TopBar";
import LogoutButton from "@/components/nav/LogoutButton";

export default async function GestorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole(["gestor", "admin"]);
  return (
    <div className="app-scroll-area bg-[var(--color-ink-50)]">
      <TopBar
        title="GN — Visão executiva"
        subtitle={profile.nome}
        right={<LogoutButton />}
      />
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
