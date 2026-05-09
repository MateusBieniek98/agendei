"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: React.ReactNode };

export default function BottomNav({ items }: { items: Item[] }) {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-ink-300)] bg-white/95 pb-[max(env(safe-area-inset-bottom),0px)] shadow-[0_-10px_30px_rgba(15,23,42,0.10)] backdrop-blur supports-[backdrop-filter]:bg-white/85"
      aria-label="Navegação principal"
    >
      <ul className="mx-auto flex h-[var(--app-bottom-nav-height)] max-w-5xl items-stretch px-1">
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                className={
                  "flex h-full flex-col items-center justify-center gap-1 rounded-2xl px-2 text-xs font-bold transition-colors active:scale-[0.98] " +
                  (active
                    ? "text-[var(--color-gn-700)]"
                    : "text-[var(--color-ink-500)] hover:bg-[var(--color-ink-100)] hover:text-[var(--color-ink-900)]")
                }
              >
                <span
                  aria-hidden
                  className={
                    "grid h-8 w-10 place-items-center rounded-full transition-colors " +
                    (active ? "bg-[var(--color-gn-100)]" : "")
                  }
                >
                  {it.icon}
                </span>
                <span className="leading-none">{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
