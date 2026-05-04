import * as React from "react";

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "rounded-2xl bg-white border border-[var(--color-ink-300)] shadow-sm " +
        className
      }
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  right,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 p-5 border-b border-[var(--color-ink-100)]">
      <div>
        <h3 className="text-base font-semibold text-[var(--color-ink-900)]">{title}</h3>
        {subtitle && (
          <p className="text-sm text-[var(--color-ink-500)] mt-0.5">{subtitle}</p>
        )}
      </div>
      {right}
    </div>
  );
}

export function CardBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={"p-5 " + className}>{children}</div>;
}

/** Card de KPI grande com número em destaque. */
export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "neutral" | "positive" | "warning" | "danger";
}) {
  const toneText: Record<string, string> = {
    neutral: "text-[var(--color-ink-900)]",
    positive: "text-[var(--color-forest-700)]",
    warning: "text-[var(--color-warn-500)]",
    danger: "text-[var(--color-danger-500)]",
  };
  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-[var(--color-ink-500)]">{label}</p>
      <p className={`mt-2 text-3xl font-bold tabular ${toneText[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--color-ink-500)]">{hint}</p>}
    </Card>
  );
}
