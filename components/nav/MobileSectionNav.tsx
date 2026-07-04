"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavItem = {
  href: string;
  label: string;
  icon?: ReactNode;
};

export default function MobileSectionNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação do painel administrativo"
      className="border-b md:hidden"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border)",
      }}
    >
      <div className="scrollbar-none flex snap-x gap-2 overflow-x-auto px-3 py-2">
        {items.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex h-10 shrink-0 snap-start items-center gap-2 rounded-lg border px-3 text-sm font-bold transition"
              style={{
                borderColor: active ? "var(--accent)" : "var(--border)",
                background: active ? "var(--accent-subtle)" : "var(--bg-card)",
                color: active ? "var(--accent)" : "var(--text-secondary)",
              }}
            >
              {item.icon && (
                <span className="h-5 w-5 shrink-0" aria-hidden>
                  {item.icon}
                </span>
              )}
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
