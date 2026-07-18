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
  "inline-flex items-center justify-center gap-2 rounded-md border font-semibold " +
  "transition-colors disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary:
    "border-[var(--accent)] bg-[var(--accent)] text-white shadow-sm hover:bg-[var(--accent-hover)]",
  secondary:
    "border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
  ghost:
    "border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]",
  danger:
    "border-[var(--danger)] bg-[var(--danger)] text-white hover:opacity-90",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  field: "h-13 min-h-12 w-full px-5 text-base",
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
