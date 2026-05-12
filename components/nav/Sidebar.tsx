"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/branding/Logo";
import LogoutButton from "@/components/nav/LogoutButton";
import ThemeToggle from "@/components/theme/ThemeToggle";
import SyncStatus from "@/components/sync/SyncStatus";

type Item = { href: string; label: string; icon?: React.ReactNode };

export default function Sidebar({
  items,
  user,
}: {
  items: Item[];
  user: { nome: string; role: string };
}) {
  const pathname = usePathname();
  return (
    <aside
      className="hidden md:flex md:flex-col w-64 shrink-0 min-h-screen"
      style={{ background: "var(--nav-bg)", borderRight: "1px solid var(--nav-border)" }}
    >
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 flex items-center gap-3">
        <Logo size={36} variant="mono-light" />
        <div>
          <p className="text-lg font-bold leading-tight" style={{ color: "var(--nav-text-active)" }}>GN</p>
          <p className="text-xs leading-tight" style={{ color: "var(--nav-text)" }}>Silvicultura</p>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-2" aria-label="Navegação admin">
        <ul className="space-y-0.5">
          {items.map((it) => {
            const active = pathname === it.href || pathname.startsWith(it.href + "/");
            return (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: active ? "var(--nav-bg-active)" : "transparent",
                    color: active ? "var(--nav-text-active)" : "var(--nav-text)",
                    fontWeight: active ? 600 : 500,
                  }}
                  onMouseEnter={(e) => {
                    if (!active) (e.currentTarget as HTMLElement).style.background = "var(--nav-bg-hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  {it.icon && (
                    <span aria-hidden className="h-5 w-5 shrink-0 opacity-80">
                      {it.icon}
                    </span>
                  )}
                  <span className="truncate">{it.label}</span>
                  {active && (
                    <span
                      className="ml-auto h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ background: "var(--accent)" }}
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div
        className="p-4"
        style={{ borderTop: "1px solid var(--nav-border)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="min-w-0">
            <p
              className="text-sm font-semibold truncate"
              style={{ color: "var(--nav-text-active)" }}
            >
              {user.nome}
            </p>
            <p
              className="text-xs capitalize"
              style={{ color: "var(--nav-text)" }}
            >
              {user.role}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <SyncStatus />
            <ThemeToggle className="text-white/60 hover:text-white/90" />
          </div>
        </div>
        <LogoutButton className="text-xs underline underline-offset-2 transition" />
      </div>
    </aside>
  );
}
