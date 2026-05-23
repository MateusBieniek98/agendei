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
        background: "var(--bg-card)",
        borderBottom: "1px solid var(--border)",
        paddingTop: "max(var(--app-top-safe-area), 6px)",
      }}
    >
      <div className="grid min-h-[56px] grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2 sm:px-4">
        <div className="flex min-w-12 items-center">
          {showLogo && <Logo size={30} variant="color" withWordmark />}
        </div>
        <div className="min-w-0 text-center">
          {title && (
            <h1
              className="truncate text-sm font-black leading-tight sm:text-base"
              style={{ color: "var(--text-primary)" }}
            >
              {title}
            </h1>
          )}
          {subtitle && (
            <p
              className="truncate text-[11px] font-semibold leading-tight sm:text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex min-w-12 shrink-0 items-center justify-end gap-1.5">
          <SyncStatus />
          {showThemeToggle && <ThemeToggle />}
          {right}
        </div>
      </div>
    </header>
  );
}
