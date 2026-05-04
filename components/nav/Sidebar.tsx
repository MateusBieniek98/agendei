"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/branding/Logo";
import LogoutButton from "@/components/nav/LogoutButton";

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
    <aside className="hidden md:flex md:flex-col w-64 shrink-0 bg-[var(--color-ink-900)] text-white min-h-screen">
      <div className="px-5 pt-6 pb-5 flex items-center gap-3">
        <Logo size={36} variant="mono-light" />
        <div>
          <p className="text-lg font-bold leading-tight">GN</p>
          <p className="text-xs text-white/60 leading-tight">Silvicultura</p>
        </div>
      </div>
      <nav className="flex-1 px-3 py-2">
        <ul className="space-y-1">
          {items.map((it) => {
            const active = pathname === it.href || pathname.startsWith(it.href + "/");
            return (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className={
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition " +
                    (active
                      ? "bg-white/10 text-white font-semibold"
                      : "text-white/80 hover:bg-white/5 hover:text-white")
                  }
                >
                  {it.icon && <span aria-hidden className="h-5 w-5">{it.icon}</span>}
                  <span>{it.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="p-4 border-t border-white/10">
        <p className="text-sm font-medium truncate">{user.nome}</p>
        <p className="text-xs text-white/60 capitalize">{user.role}</p>
        <LogoutButton className="mt-3 text-xs text-white/80 hover:text-white underline underline-offset-2" />
      </div>
    </aside>
  );
}
