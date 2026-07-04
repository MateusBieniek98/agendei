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
    <section
      className="overflow-hidden rounded-lg border"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border)",
        color: "var(--text-primary)",
      }}
    >
      <div className="flex flex-col gap-3 border-l-4 p-4 sm:flex-row sm:items-end sm:justify-between" style={{ borderLeftColor: "var(--brand-green)" }}>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase" style={{ color: "var(--accent)" }}>
            {eyebrow}
          </p>
          <h1 className="mt-1 truncate text-xl font-bold leading-tight sm:text-2xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-snug" style={{ color: "var(--text-secondary)" }}>
              {subtitle}
            </p>
          )}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
    </section>
  );
}
