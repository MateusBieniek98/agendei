"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type AdminToolItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

const ADMIN_TOOLS: AdminToolItem[] = [
  { href: "/admin", label: "Dashboard", icon: <DashboardIcon /> },
  { href: "/admin/insumos", label: "Insumos", icon: <PackageIcon /> },
  { href: "/admin/lancamentos", label: "Lançamentos", icon: <ListIcon /> },
  { href: "/admin/atividades", label: "Serviços", icon: <TagIcon /> },
  { href: "/admin/equipes", label: "Cad. equipes", icon: <UsersIcon /> },
  { href: "/admin/projetos", label: "Projetos", icon: <MapIcon /> },
  { href: "/admin/maquinas", label: "Frota", icon: <CogIcon /> },
  { href: "/admin/planejamento", label: "Plano admin", icon: <CalendarIcon /> },
  { href: "/admin/metas", label: "Metas", icon: <TargetIcon /> },
  { href: "/admin/usuarios", label: "Usuários", icon: <UserIcon /> },
  { href: "/admin/entrada", label: "Entrada", icon: <TextIcon /> },
  { href: "/admin/automacoes", label: "Automações", icon: <AutomationIcon /> },
];

export default function AdminToolsNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Funções administrativas"
      className="border-b"
      style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}
    >
      <div className="scrollbar-none mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 py-2 sm:flex-wrap sm:overflow-x-visible sm:px-4 md:px-6">
        {ADMIN_TOOLS.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex h-10 min-w-11 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-bold transition"
              style={{
                borderColor: active ? "var(--border-strong)" : "transparent",
                background: active ? "var(--bg-card-alt)" : "transparent",
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
                boxShadow: active ? "inset 0 -2px 0 var(--brand-green)" : "none",
              }}
              aria-current={active ? "page" : undefined}
            >
              <span className="grid h-4 w-4 place-items-center" aria-hidden>
                {item.icon}
              </span>
              <span className="whitespace-nowrap">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function SvgIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function DashboardIcon() {
  return (
    <SvgIcon>
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </SvgIcon>
  );
}

function ListIcon() {
  return (
    <SvgIcon>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </SvgIcon>
  );
}

function TagIcon() {
  return (
    <SvgIcon>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2a2 2 0 0 1 0-2.8L10.6 3.4a2 2 0 0 1 1.4-.6h6.6a2 2 0 0 1 2 2v6.6a2 2 0 0 1-.6 1.4Z" />
      <circle cx="16" cy="8" r="1.5" />
    </SvgIcon>
  );
}

function PackageIcon() {
  return (
    <SvgIcon>
      <path d="m21 8-9-5-9 5 9 5 9-5Z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </SvgIcon>
  );
}

function UsersIcon() {
  return (
    <SvgIcon>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.9" />
      <path d="M16 3.1a4 4 0 0 1 0 7.8" />
    </SvgIcon>
  );
}

function MapIcon() {
  return (
    <SvgIcon>
      <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" />
      <path d="M9 3v15M15 6v15" />
    </SvgIcon>
  );
}

function CogIcon() {
  return (
    <SvgIcon>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </SvgIcon>
  );
}

function CalendarIcon() {
  return (
    <SvgIcon>
      <path d="M8 2v4M16 2v4M3 10h18" />
      <rect x="3" y="4" width="18" height="18" rx="2" />
    </SvgIcon>
  );
}

function TargetIcon() {
  return (
    <SvgIcon>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </SvgIcon>
  );
}

function UserIcon() {
  return (
    <SvgIcon>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </SvgIcon>
  );
}

function TextIcon() {
  return (
    <SvgIcon>
      <path d="M4 7V4h16v3" />
      <path d="M9 20h6" />
      <path d="M12 4v16" />
    </SvgIcon>
  );
}

function AutomationIcon() {
  return (
    <SvgIcon>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </SvgIcon>
  );
}
