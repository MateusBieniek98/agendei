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
          className="text-sm font-bold text-[var(--text-primary)]"
        >
          {label}
        </label>
      )}
      <select
        id={finalId}
        className={
          "h-11 min-h-11 rounded-lg border bg-[var(--bg-input)] px-3 text-sm font-semibold " +
          "text-[var(--text-primary)] focus:border-[var(--border-focus)] outline-none transition " +
          (error ? "border-[var(--danger)] " : "border-[var(--border)] ") +
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
        <p className="text-xs font-bold text-[var(--danger)]">{error}</p>
      )}
    </div>
  );
}
