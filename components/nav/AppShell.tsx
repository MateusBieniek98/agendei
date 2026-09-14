"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";
import LogoutButton from "./LogoutButton";
import NavigationIcon from "./NavigationIcon";
import SyncStatus from "@/components/sync/SyncStatus";
import ThemeToggle from "@/components/theme/ThemeToggle";
import type { NavigationGroup, NavigationItem } from "./navigation";
import Logo from "@/components/branding/Logo";
import { PRODUCT_BRAND } from "@/lib/product-brand";
import { setActiveOrganizationId } from "@/lib/tenant-client";

type AppShellProps = {
  children: React.ReactNode;
  navigation: NavigationGroup[];
  user: { nome: string; role: string };
  areaLabel: string;
  organization: { id: string; displayName: string };
  organizations?: Array<{ id: string; displayName: string }>;
  mobileStrategy?: "drawer" | "bottom";
  contentWidth?: "standard" | "wide";
};

function isItemActive(pathname: string, item: NavigationItem) {
  const itemPath = item.href.split("?", 1)[0];
  return item.exact ? pathname === itemPath : pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

function roleName(role: string) {
  if (role === "admin") return "Administrador";
  if (role === "gestor") return "Gestor";
  if (role === "manutencao") return "Manutenção";
  return "Encarregado";
}

function NavigationList({
  groups,
  pathname,
  onNavigate,
}: {
  groups: NavigationGroup[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Navegação principal" className="space-y-5">
      {groups.map((group) => (
        <section key={group.label}>
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
            {group.label}
          </p>
          <ul className="space-y-1">
            {group.items.map((item) => {
              const active = isItemActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
                      active
                        ? "bg-white/12 text-white"
                        : "text-white/68 hover:bg-white/7 hover:text-white"
                    }`}
                  >
                    {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[#d6a23a]" />}
                    <span className={active ? "text-[#b9d8c7]" : "text-white/52 group-hover:text-white/80"}>
                      <NavigationIcon name={item.icon} />
                    </span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}

export default function AppShell({
  children,
  navigation,
  user,
  areaLabel,
  organization,
  organizations = [],
  mobileStrategy = "drawer",
  contentWidth = "wide",
}: AppShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const items = useMemo(() => navigation.flatMap((group) => group.items), [navigation]);
  const activeItem = items.find((item) => isItemActive(pathname, item));
  const pageTitle = activeItem?.label ?? areaLabel;

  async function switchOrganization(organizationId: string) {
    if (!organizationId || organizationId === organization.id) return;
    const response = await fetch("/api/organizations/active", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organization_id: organizationId }),
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) window.location.assign(body.home ?? "/");
  }

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useLayoutEffect(() => {
    setActiveOrganizationId(organization.id);
  }, [organization.id]);

  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [drawerOpen]);

  const sidebarContent = (
    <>
      <div className="flex h-[calc(72px+max(var(--app-top-safe-area),20px))] items-center gap-3 border-b border-white/10 px-5 pt-[max(var(--app-top-safe-area),20px)] lg:h-[72px] lg:pt-0">
        <Logo size={38} variant="mono-light" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{PRODUCT_BRAND.shortName}</p>
          {organizations.length > 1 ? (
            <select
              aria-label="Empresa ativa"
              value={organization.id}
              onChange={(event) => void switchOrganization(event.target.value)}
              className="max-w-40 truncate bg-transparent text-xs text-white/60 outline-none"
            >
              {organizations.map((item) => (
                <option key={item.id} value={item.id} className="text-slate-900">{item.displayName}</option>
              ))}
            </select>
          ) : (
            <p className="truncate text-xs text-white/48">{organization.displayName}</p>
          )}
        </div>
        <button type="button" onClick={() => setDrawerOpen(false)} className="ml-auto grid h-9 w-9 place-items-center rounded-md text-xl font-light text-white/60 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Fechar menu">
          ×
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <NavigationList groups={navigation} pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
      </div>
      <div className="border-t border-white/10 p-4 pb-[max(1rem,var(--app-bottom-safe-area))]">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-semibold text-white">
            {user.nome.trim().slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.nome}</p>
            <p className="truncate text-xs text-white/48">{roleName(user.role)}</p>
          </div>
          <ThemeToggle className="text-white/60 hover:bg-white/10 hover:text-white" />
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-white/8 pt-3">
          <SyncStatus />
          <LogoutButton className="min-h-9 rounded-md px-2 text-xs font-medium text-white/60 transition hover:bg-white/10 hover:text-white">
            Sair
          </LogoutButton>
        </div>
      </div>
    </>
  );

  return (
    <div className={`corporate-shell min-h-dvh bg-[var(--bg-page)] text-[var(--text-primary)] ${mobileStrategy === "bottom" ? "with-bottom-nav lg:pb-0" : ""}`}>
      <div className="lg:flex lg:min-h-dvh">
        <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col overflow-hidden bg-[var(--shell-bg)] lg:flex">
          {sidebarContent}
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-elevated)_96%,transparent)] pt-[max(var(--app-top-safe-area),20px)] backdrop-blur-xl lg:pt-0">
            <div className="flex min-h-[64px] items-center gap-3 px-3 sm:px-5 lg:px-7">
              {mobileStrategy === "drawer" ? (
                <button type="button" onClick={() => setDrawerOpen(true)} className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] lg:hidden" aria-label="Abrir menu" aria-expanded={drawerOpen}>
                  <span className="space-y-1.5"><span className="block h-0.5 w-5 bg-current" /><span className="block h-0.5 w-5 bg-current" /><span className="block h-0.5 w-5 bg-current" /></span>
                </button>
              ) : (
                <Logo size={34} className="lg:hidden" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium text-[var(--text-muted)]">{organization.displayName} · {areaLabel}</p>
                <h1 className="truncate text-base font-semibold text-[var(--text-primary)]">{pageTitle}</h1>
              </div>
              <div className="flex items-center gap-1 lg:hidden">
                {mobileStrategy === "bottom" && <SyncStatus />}
                <ThemeToggle />
                <LogoutButton className="inline-flex min-h-9 items-center rounded-md px-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">
                  Sair
                </LogoutButton>
              </div>
              <div className="hidden items-center gap-3 text-right lg:flex">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{user.nome}</p>
                  <p className="text-xs text-[var(--text-muted)]">{roleName(user.role)}</p>
                </div>
              </div>
            </div>
          </header>

          <main className={`mx-auto w-full px-3 py-4 sm:px-5 sm:py-6 lg:px-7 lg:py-7 ${contentWidth === "standard" ? "max-w-6xl" : "max-w-[1480px]"}`}>
            {children}
          </main>
        </div>
      </div>

      {mobileStrategy === "drawer" && drawerOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/52 backdrop-blur-[2px]" onClick={() => setDrawerOpen(false)} aria-label="Fechar menu" />
          <aside className="relative flex h-full w-[min(86vw,320px)] flex-col bg-[var(--shell-bg)] shadow-2xl" aria-label="Menu do sistema">
            {sidebarContent}
          </aside>
        </div>
      )}

      {mobileStrategy === "bottom" && <div className="lg:hidden"><BottomNav viewType="encarregado" /></div>}
    </div>
  );
}
