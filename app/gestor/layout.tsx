import { requireRole } from "@/lib/auth";
import Link from "next/link";
import TopBar from "@/components/nav/TopBar";
import LogoutButton from "@/components/nav/LogoutButton";

export default async function GestorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole(["gestor", "admin"]);
  return (
    <div className="app-scroll-area bg-[var(--bg-page)]">
      <TopBar
        title="GN — Visão executiva"
        subtitle={profile.nome}
        right={
          <div className="flex items-center gap-2">
            <Link
              href="/gestor"
              className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm font-bold text-[var(--text-primary)] shadow-sm"
            >
              Dashboard
            </Link>
            <LogoutButton />
          </div>
        }
      />
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
