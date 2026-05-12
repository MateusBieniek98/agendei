"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type FABItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  color?: string;
};

const DEFAULT_ITEMS: FABItem[] = [
  {
    label: "Lançar Produção",
    href: "/lancamento",
    color: "#16a34a",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
           strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M12 5v14M5 12h14" />
      </svg>
    ),
  },
  {
    label: "Reportar Máquina",
    href: "/maquinas",
    color: "#d97706",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
      </svg>
    ),
  },
  {
    label: "Novo Planejamento",
    href: "/admin/planejamento",
    color: "#2f80ed",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M8 2v4M16 2v4M3 10h18" />
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
      </svg>
    ),
  },
];

export default function FAB({ items = DEFAULT_ITEMS }: { items?: FABItem[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Fecha com Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div ref={ref} className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] right-5 z-50 flex flex-col items-end gap-3">
      {/* Items do menu radial */}
      {open && items.map((item, i) => (
        <div
          key={item.href}
          className="fab-item flex items-center gap-3"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          {/* Label */}
          <span
            className="rounded-lg px-3 py-1.5 text-sm font-semibold shadow-md whitespace-nowrap"
            style={{ background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
          >
            {item.label}
          </span>
          {/* Botão circular */}
          <button
            onClick={() => { setOpen(false); router.push(item.href); }}
            className="h-12 w-12 rounded-full text-white shadow-lg flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
            style={{ background: item.color ?? "var(--accent)" }}
            aria-label={item.label}
          >
            {item.icon}
          </button>
        </div>
      ))}

      {/* Botão principal + */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fechar menu" : "Ações rápidas"}
        aria-expanded={open}
        className="h-14 w-14 rounded-full text-white shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        style={{ background: open ? "#374151" : "var(--accent)" }}
      >
        <span
          className="transition-transform duration-200"
          style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)", display: "block" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
               strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </button>

      {/* Overlay semitransparente quando aberto */}
      {open && (
        <div
          className="fixed inset-0 -z-10"
          style={{ background: "rgba(0,0,0,0.35)" }}
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}
