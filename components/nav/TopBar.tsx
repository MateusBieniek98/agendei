"use client";

import Logo from "@/components/branding/Logo";

export default function TopBar({
  title,
  subtitle,
  right,
  showLogo = true,
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  showLogo?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-[var(--color-ink-300)]">
      <div className="flex items-center gap-3 px-4 py-3">
        {showLogo && <Logo size={32} variant="color" />}
        <div className="flex-1 min-w-0">
          {title && <h1 className="text-base font-bold truncate">{title}</h1>}
          {subtitle && (
            <p className="truncate text-xs font-bold text-[var(--color-ink-600)]">{subtitle}</p>
          )}
        </div>
        {right}
      </div>
    </header>
  );
}
