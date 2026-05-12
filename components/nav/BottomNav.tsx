"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: React.ReactNode };

export default function BottomNav({ items }: { items: Item[] }) {
  const pathname = usePathname();
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 pb-[max(env(safe-area-inset-bottom),0px)]"
      style={{
        background: "var(--bottomnav-bg)",
        borderTop: "1px solid var(--bottomnav-border)",
      }}
      aria-label="Navegação principal"
    >
      <ul className="flex">
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                className="flex flex-col items-center justify-center gap-1 py-3 text-xs font-semibold transition-colors"
                style={{
                  color: active ? "var(--bottomnav-active)" : "var(--bottomnav-text)",
                }}
              >
                <span
                  aria-hidden
                  className="h-6 w-6 transition-transform"
                  style={{ transform: active ? "scale(1.1)" : "scale(1)" }}
                >
                  {it.icon}
                </span>
                <span>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
