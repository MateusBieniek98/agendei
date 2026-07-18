"use client";

import type { ReactNode } from "react";

export default function PageHeader({
  eyebrow = "GN Operações",
  title,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-[var(--divider)] pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--text-muted)]">{eyebrow}</p>
        <h1 className="mt-1 text-xl font-semibold leading-tight tracking-[-0.02em] text-[var(--text-primary)] sm:text-2xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 max-w-3xl text-sm font-normal leading-relaxed text-[var(--text-secondary)]">
            {subtitle}
          </p>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </header>
  );
}
