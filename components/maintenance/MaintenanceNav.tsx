"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/manutencao", label: "Solicitações" },
  { href: "/manutencao/maquinas", label: "Máquinas" },
];

export default function MaintenanceNav() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-[72px] z-30 border-b border-[var(--border)] bg-[var(--bg-card)]" aria-label="Navegação da manutenção">
      <div className="mx-auto flex max-w-7xl px-3 sm:px-4 md:px-6">
        {ITEMS.map((item) => {
          const active = item.href === "/manutencao" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className="flex min-h-12 flex-1 items-center justify-center border-b-2 px-4 text-sm font-bold sm:flex-none" style={{ borderColor: active ? "var(--accent)" : "transparent", color: active ? "var(--accent)" : "var(--text-muted)" }} aria-current={active ? "page" : undefined}>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
