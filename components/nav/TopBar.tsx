"use client";

import Logo from "@/components/branding/Logo";
import ThemeToggle from "@/components/theme/ThemeToggle";
import SyncStatus from "@/components/sync/SyncStatus";

function roleTone(title?: string) {
  const key = (title ?? "").toLowerCase();
  if (key.includes("admin")) {
    return {
      bg: "var(--accent-subtle)",
      border: "var(--accent)",
      color: "var(--accent)",
    };
  }
  if (key.includes("gestor")) {
    return {
      bg: "#eef5fb",
      border: "var(--brand-blue)",
      color: "var(--brand-blue)",
    };
  }
  return {
    bg: "var(--success-bg)",
    border: "var(--success)",
    color: "var(--success)",
  };
}

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
  const tone = roleTone(title);

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: "color-mix(in srgb, var(--bg-card) 96%, transparent)",
        borderBottom: "1px solid var(--border)",
        paddingTop: "max(var(--app-top-safe-area), 8px)",
        backdropFilter: "blur(14px)",
      }}
    >
      <div className="mx-auto grid min-h-[64px] max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2 sm:px-4 md:px-6">
        <div className="flex min-w-10 items-center">
          {showLogo && (
            <span className="rounded-lg border border-[var(--border)] bg-[var(--bg-card-alt)] px-2 py-1">
              <Logo size={30} variant="color" withWordmark />
            </span>
          )}
        </div>
        <div className="min-w-0 text-left">
          <p className="text-[10px] font-bold uppercase" style={{ color: "var(--text-muted)" }}>
            GN Operações
          </p>
          <div className="mt-0.5 flex min-w-0 items-center gap-2">
            {title && (
              <span
                className="shrink-0 rounded-md border px-2 py-0.5 text-xs font-bold uppercase"
                style={{
                  background: tone.bg,
                  borderColor: tone.border,
                  color: tone.color,
                }}
              >
                {title}
              </span>
            )}
            {subtitle && (
              <p
                className="truncate text-sm font-bold leading-tight"
                style={{ color: "var(--text-primary)" }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {subtitle && (
            <p
              className="mt-0.5 truncate text-[11px] font-semibold leading-tight sm:text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Perfil ativo no dispositivo
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
