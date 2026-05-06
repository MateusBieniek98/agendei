"use client";

import * as React from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  hint?: string;
};

export default function Input({
  label,
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
          className="text-sm font-bold text-[var(--color-ink-900)]"
        >
          {label}
        </label>
      )}
      <input
        id={finalId}
        className={
          "h-13 min-h-12 rounded-xl border-2 bg-white px-3 text-base font-bold " +
          "text-[var(--color-ink-900)] shadow-sm placeholder:font-bold placeholder:text-[var(--color-ink-700)] " +
          "focus:border-[var(--color-gn-500)] outline-none transition " +
          (error ? "border-[var(--color-danger-500)] " : "border-[var(--color-ink-300)] ") +
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
              : "font-semibold text-[var(--color-ink-700)]")
          }
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
