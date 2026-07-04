"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type DashboardDockTab = "indicadores" | "equipes" | "manutencao" | "planejamento";
export type BottomNavViewType = "gestor" | "admin" | "encarregado";

type RouteItem = { href: string; label: string; icon: ReactNode };
type DockItem = { key: DashboardDockTab; label: string; icon: ReactNode };

type BottomNavProps = {
  viewType?: BottomNavViewType;
  items?: RouteItem[];
  activeTab?: DashboardDockTab;
  onTabChange?: (tab: DashboardDockTab) => void;
};

const DASHBOARD_ITEMS: DockItem[] = [
  { key: "indicadores", label: "Indicadores", icon: <IconGauge /> },
  { key: "equipes", label: "Equipes", icon: <IconUsers /> },
  { key: "manutencao", label: "Manutenção", icon: <IconWrench /> },
  { key: "planejamento", label: "Planejamento", icon: <IconCalendar /> },
];

const FIELD_ITEMS: RouteItem[] = [
  { href: "/sincronizar", label: "Sync", icon: <IconSync /> },
  { href: "/resumo", label: "Resultados", icon: <IconChart /> },
  { href: "/lancamento", label: "Lançar", icon: <IconPlus /> },
  { href: "/maquinas", label: "Manut.", icon: <IconWrench /> },
  { href: "/planejamento", label: "Plano", icon: <IconCalendar /> },
];

export default function BottomNav({
  viewType = "encarregado",
  items,
  activeTab = "indicadores",
  onTabChange,
}: BottomNavProps) {
  const pathname = usePathname();
  const isDashboardDock = viewType === "gestor" || viewType === "admin";
  const routeItems = items ?? FIELD_ITEMS;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 h-[calc(3.75rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)]"
      style={{
        background: "color-mix(in srgb, var(--bottomnav-bg) 94%, transparent)",
        borderTop: "1px solid var(--bottomnav-border)",
        backdropFilter: "blur(14px)",
      }}
      aria-label="Navegação principal"
      data-view-type={viewType}
    >
      <ul className="mx-auto flex h-[3.75rem] max-w-3xl items-stretch gap-0 px-1.5">
        {isDashboardDock
          ? DASHBOARD_ITEMS.map((item) => {
              const active = activeTab === item.key;
              return (
                <li key={item.key} className="flex-1">
                  <button
                    type="button"
                    onClick={() => onTabChange?.(item.key)}
                    className="relative flex h-full min-h-11 w-full touch-manipulation flex-col items-center justify-center gap-0.5 rounded-none border-t-2 px-1 text-[10px] font-bold leading-tight transition sm:text-xs"
                    style={{
                      background: "transparent",
                      borderColor: active ? "var(--bottomnav-active)" : "transparent",
                      color: active ? "var(--bottomnav-active)" : "var(--bottomnav-text)",
                    }}
                    aria-current={active ? "page" : undefined}
                  >
                    <span
                      aria-hidden
                      className="grid h-6 w-6 place-items-center transition-transform"
                      style={{ transform: active ? "translateY(-1px)" : "none" }}
                    >
                      {item.icon}
                    </span>
                    <span className="max-w-full truncate">{item.label}</span>
                  </button>
                </li>
              );
            })
          : routeItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const primary = item.href === "/lancamento";
              return (
                <li key={item.href} className="flex-1">
                  <Link
                    href={item.href}
                    className="relative flex h-full min-h-11 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-none border-t-2 px-1 text-[10px] font-bold leading-tight transition sm:text-xs"
                    style={{
                      background: primary ? "rgba(31,111,85,0.18)" : "transparent",
                      borderColor: active || primary ? "var(--bottomnav-active)" : "transparent",
                      color: active || primary ? "var(--bottomnav-active)" : "var(--bottomnav-text)",
                    }}
                    aria-current={active ? "page" : undefined}
                  >
                    <span
                      aria-hidden
                      className="grid h-6 w-6 place-items-center transition-transform"
                      style={{ transform: active ? "translateY(-1px)" : "none" }}
                    >
                      {item.icon}
                    </span>
                    <span className="max-w-full truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
      </ul>
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
      className="h-5 w-5"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function IconGauge() {
  return (
    <SvgIcon>
      <path d="M4 13a8 8 0 1 1 16 0" />
      <path d="M12 13l4-4" />
      <path d="M7 21h10" />
    </SvgIcon>
  );
}

function IconUsers() {
  return (
    <SvgIcon>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </SvgIcon>
  );
}

function IconWrench() {
  return (
    <SvgIcon>
      <path d="M14.7 6.3a4 4 0 0 0 4.9 4.9l-8.4 8.4a2.1 2.1 0 0 1-3-3l8.4-8.4Z" />
      <path d="m5 19 2-2" />
    </SvgIcon>
  );
}

function IconCalendar() {
  return (
    <SvgIcon>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </SvgIcon>
  );
}

function IconSync() {
  return (
    <SvgIcon>
      <path d="M21 12a9 9 0 0 1-15.5 6.2" />
      <path d="M3 12a9 9 0 0 1 15.5-6.2" />
      <path d="M18 3v4h-4" />
      <path d="M6 21v-4h4" />
    </SvgIcon>
  );
}

function IconChart() {
  return (
    <SvgIcon>
      <path d="M4 19V5M4 19h16M8 16V9M13 16V7M18 16v-4" />
    </SvgIcon>
  );
}

function IconPlus() {
  return (
    <SvgIcon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </SvgIcon>
  );
}
