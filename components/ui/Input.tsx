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
          className="text-sm font-medium text-[var(--color-ink-700)]"
        >
          {label}
        </label>
      )}
      <input
        id={finalId}
        className={
          "h-12 rounded-xl border border-[var(--color-ink-300)] bg-white px-3 text-base " +
          "placeholder:text-[var(--color-ink-500)] focus:border-[var(--color-gn-500)] " +
          "outline-none transition " +
          (error ? "border-[var(--color-danger-500)] " : "") +
          (className ?? "")
        }
        {...rest}
      />
      {(error || hint) && (
        <p
          className={
            "text-xs " +
            (error
              ? "text-[var(--color-danger-500)]"
              : "text-[var(--color-ink-500)]")
          }
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
