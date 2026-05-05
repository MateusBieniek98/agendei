"use client";

import * as React from "react";

type Option = { value: string; label: string };
type Props = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> & {
  label?: string;
  options: Option[];
  placeholder?: string;
  error?: string;
};

export default function Select({
  label,
  options,
  placeholder,
  error,
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
      <select
        id={finalId}
        className={
          "h-13 min-h-12 rounded-xl border-2 bg-white px-3 text-base font-semibold " +
          "text-[var(--color-ink-900)] shadow-sm focus:border-[var(--color-gn-500)] outline-none transition " +
          (error ? "border-[var(--color-danger-500)] " : "border-[var(--color-ink-300)] ") +
          (className ?? "")
        }
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="text-xs font-bold text-[var(--color-danger-500)]">{error}</p>
      )}
    </div>
  );
}
