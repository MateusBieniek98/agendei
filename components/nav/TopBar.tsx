"use client";

import Logo from "@/components/branding/Logo";
import ThemeToggle from "@/components/theme/ThemeToggle";
import SyncStatus from "@/components/sync/SyncStatus";

export default function TopBar({
  title,
  subtitle,
  right,
  showLogo = true,
  showThemeToggle = false,
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  showLogo?: boolean;
  showThemeToggle?: boolean;
}) {
  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: "color-mix(in srgb, var(--shell-bg) 96%, transparent)",
        borderBottom: "1px solid var(--shell-line)",
        paddingTop: "max(var(--app-top-safe-area), 8px)",
        backdropFilter: "blur(14px)",
      }}
    >
      <div className="mx-auto grid min-h-[64px] max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2 sm:px-4 md:px-6">
        <div className="flex min-w-10 items-center">
          {showLogo && (
            <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1">
              <Logo size={30} variant="mono-light" withWordmark />
            </span>
          )}
        </div>
        <div className="min-w-0 text-left">
          <p className="text-[10px] font-bold uppercase" style={{ color: "rgba(255,255,255,0.52)" }}>
            GN Operações
          </p>
          {title && (
            <h1
              className="truncate text-base font-bold leading-tight sm:text-lg"
              style={{ color: "#fff" }}
            >
              {title}
            </h1>
          )}
          {subtitle && (
            <p
              className="truncate text-[11px] font-semibold leading-tight sm:text-xs"
              style={{ color: "rgba(255,255,255,0.64)" }}
            >
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex min-w-10 shrink-0 items-center justify-end gap-1">
          <SyncStatus />
          {showThemeToggle && <ThemeToggle />}
          {right}
        </div>
      </div>
    </header>
  );
}
