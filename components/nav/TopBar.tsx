"use client";

import Logo from "@/components/branding/Logo";
import ThemeToggle from "@/components/theme/ThemeToggle";
import SyncStatus from "@/components/sync/SyncStatus";

export default function TopBar({
  title,
  subtitle,
  right,
  showLogo = true,
  showThemeToggle = true,
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  showLogo?: boolean;
  showThemeToggle?: boolean;
}) {
  return (
    <header
      className="sticky top-0 z-30"
      style={{
        background: "var(--bg-card)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {showLogo && <Logo size={32} variant="color" />}
        <div className="flex-1 min-w-0">
          {title && (
            <h1
              className="text-base font-bold truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {title}
            </h1>
          )}
          {subtitle && (
            <p
              className="truncate text-xs font-semibold"
              style={{ color: "var(--text-secondary)" }}
            >
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <SyncStatus />
          {showThemeToggle && <ThemeToggle />}
          {right}
        </div>
      </div>
    </header>
  );
}
