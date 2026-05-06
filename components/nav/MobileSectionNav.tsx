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
      className="border-b border-[var(--color-ink-200)] bg-white md:hidden"
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
              className={
                "inline-flex h-11 shrink-0 snap-start items-center gap-2 rounded-xl border-2 px-3 text-sm font-bold transition " +
                (active
                  ? "border-[var(--color-gn-600)] bg-[var(--color-gn-50)] text-[var(--color-gn-700)]"
                  : "border-[var(--color-ink-200)] bg-white text-[var(--color-ink-700)]")
              }
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
