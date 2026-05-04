// Botão padrão GN. Variantes: primary, secondary, ghost, danger.
// `field` aumenta a área de toque (uso em campo, com luvas/sol).

"use client";

import * as React from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "field";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold " +
  "transition active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--color-gn-600)] text-white hover:bg-[var(--color-gn-700)] shadow-sm",
  secondary:
    "bg-white text-[var(--color-gn-700)] border border-[var(--color-ink-300)] hover:bg-[var(--color-ink-50)]",
  ghost:
    "bg-transparent text-[var(--color-ink-700)] hover:bg-[var(--color-ink-100)]",
  danger:
    "bg-[var(--color-danger-500)] text-white hover:opacity-90 shadow-sm",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-base",
  field: "h-14 px-6 text-lg w-full",
};

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className ?? ""}`}
    >
      {loading && (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
