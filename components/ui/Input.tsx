"use client";

import * as React from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  labelClassName?: string;
  error?: string;
  hint?: string;
};

export default function Input({
  label,
  labelClassName,
  error,
  hint,
  id,
  className,
  ...rest
}: Props) {
  const autoId = React.useId();
  const finalId = id ?? autoId;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={finalId}
          className={
            "text-sm font-bold text-[var(--text-primary)] " +
            (labelClassName ?? "")
          }
        >
          {label}
        </label>
      )}
      <input
        id={finalId}
        className={
          "h-11 min-h-11 rounded-lg border bg-[var(--bg-input)] px-3 text-sm font-semibold " +
          "text-[var(--text-primary)] placeholder:font-semibold placeholder:text-[var(--text-muted)] " +
          "focus:border-[var(--border-focus)] outline-none transition " +
          (error ? "border-[var(--danger)] " : "border-[var(--border)] ") +
          (className ?? "")
        }
        {...rest}
      />
      {(error || hint) && (
        <p
          className={
            "text-xs " +
            (error
              ? "font-bold text-[var(--color-danger-500)]"
              : "font-semibold text-[var(--text-secondary)]")
          }
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
