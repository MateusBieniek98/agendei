import type { HTMLAttributes } from "react";

function join(...values: Array<string | undefined | false>) {
  return values.filter(Boolean).join(" ");
}

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={join("ui-skeleton rounded-md", className)}
      {...props}
    />
  );
}

export function TableSkeleton({
  rows = 6,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div
      className={join(
        "overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)]",
        className
      )}
    >
      <div
        className="grid gap-4 border-b border-[var(--divider)] bg-[var(--bg-card-alt)] px-4 py-3"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton key={index} className="h-3 w-2/3" />
        ))}
      </div>
      <div className="divide-y divide-[var(--divider)]">
        {Array.from({ length: rows }, (_, row) => (
          <div
            key={row}
            className="grid gap-4 px-4 py-3.5"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }, (_, column) => (
              <Skeleton
                key={column}
                className={join(
                  "h-3.5",
                  column === 0 ? "w-4/5" : column === columns - 1 ? "w-1/2" : "w-2/3"
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardGridSkeleton({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={join("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-8 w-8 shrink-0" />
          </div>
          <Skeleton className="mt-5 h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({
  count = 5,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={join(
        "divide-y divide-[var(--divider)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)]",
        className
      )}
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-4">
          <Skeleton className="h-10 w-10 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-[min(18rem,72%)]" />
            <Skeleton className="h-3 w-[min(24rem,88%)]" />
          </div>
          <Skeleton className="h-8 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton({
  fields = 5,
  className,
}: {
  fields?: number;
  className?: string;
}) {
  return (
    <div className={join("rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-5", className)}>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: fields }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={join(
        "rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-5",
        className
      )}
    >
      <Skeleton className="h-4 w-36" />
      <Skeleton className="mt-2 h-3 w-52 max-w-full" />
      <div className="mt-5 flex h-52 items-end gap-2 border-b border-l border-[var(--divider)] px-3 pb-3">
        {[38, 64, 48, 82, 58, 74, 44, 70, 88, 62, 78, 52].map((height, index) => (
          <Skeleton key={index} className="min-w-0 flex-1" style={{ height: `${height}%` }} />
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton({
  variant = "dashboard",
}: {
  variant?: "dashboard" | "list" | "form";
}) {
  return (
    <div
      className="space-y-5"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Carregando conteúdo"
    >
      <span className="sr-only">Carregando conteúdo</span>
      <div className="flex items-end justify-between gap-4 border-b border-[var(--divider)] pb-4">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-7 w-[min(22rem,72%)]" />
          <Skeleton className="h-3 w-[min(34rem,90%)]" />
        </div>
        <Skeleton className="hidden h-10 w-28 sm:block" />
      </div>

      {variant === "dashboard" && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4"
              >
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-3 h-8 w-3/4" />
                <Skeleton className="mt-2 h-3 w-24" />
              </div>
            ))}
          </div>
          <ChartSkeleton />
        </>
      )}

      {variant === "list" && (
        <>
          <Skeleton className="h-11 w-full" />
          <ListSkeleton />
        </>
      )}

      {variant === "form" && <FormSkeleton />}
    </div>
  );
}

export function InlineProgress({ label = "Atualizando" }: { label?: string }) {
  return (
    <span className="inline-flex min-h-5 items-center gap-2 text-xs font-medium text-[var(--text-muted)]" role="status">
      <span className="ui-spinner h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}
