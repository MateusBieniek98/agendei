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
        "rounded-lg border border-[var(--border)] bg-[var(--bg-card)] shadow-sm " +
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
    <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
      <div>
        <h3 className="text-sm font-bold text-[var(--text-primary)]">{title}</h3>
        {subtitle && (
          <p className="mt-0.5 text-xs font-semibold text-[var(--text-muted)]">{subtitle}</p>
        )}
      </div>
      {right}
    </div>
  );
}

export function CardBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={"p-4 " + className}>{children}</div>;
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
    neutral: "text-[var(--text-primary)]",
    positive: "text-[var(--success)]",
    warning: "text-[var(--warn)]",
    danger: "text-[var(--danger)]",
  };
  return (
    <Card className="p-4 sm:p-5">
      <p className="text-xs font-bold uppercase text-[var(--text-muted)]">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular sm:text-3xl ${toneText[tone]}`}>
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-xs font-semibold text-[var(--text-secondary)]">
          {hint}
        </p>
      )}
    </Card>
  );
}
