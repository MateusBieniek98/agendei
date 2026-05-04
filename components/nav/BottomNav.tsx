"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: React.ReactNode };

export default function BottomNav({ items }: { items: Item[] }) {
  const pathname = usePathname();
  return (
    <nav
      className="fixed bottom-0 inset-x-0 bg-white border-t border-[var(--color-ink-300)] z-40 pb-[max(env(safe-area-inset-bottom),0px)]"
      aria-label="Navegação principal"
    >
      <ul className="flex">
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                className={
                  "flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium " +
                  (active
                    ? "text-[var(--color-gn-700)]"
                    : "text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]")
                }
              >
                <span aria-hidden className="h-6 w-6">{it.icon}</span>
                <span>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
