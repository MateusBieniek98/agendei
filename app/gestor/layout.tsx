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
    <div className="min-h-screen">
      <TopBar
        title="GN — Visão executiva"
        subtitle={profile.nome}
        right={<LogoutButton />}
      />
      <main className="px-4 md:px-8 py-6 max-w-6xl mx-auto">{children}</main>
    </div>
  );
}
