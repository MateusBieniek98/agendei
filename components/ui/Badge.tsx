import * as React from "react";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "border-[var(--border)] bg-[var(--bg-card-alt)] text-[var(--text-secondary)]",
  success: "border-[color-mix(in_srgb,var(--success)_28%,transparent)] bg-[var(--success-bg)] text-[var(--success)]",
  warning: "border-[color-mix(in_srgb,var(--warn)_28%,transparent)] bg-[var(--warn-bg)] text-[var(--warn)]",
  danger: "border-[color-mix(in_srgb,var(--danger)_28%,transparent)] bg-[var(--danger-bg)] text-[var(--danger)]",
  info: "border-[color-mix(in_srgb,var(--accent)_24%,transparent)] bg-[var(--accent-subtle)] text-[var(--accent)]",
};

export default function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold " +
        tones[tone]
      }
    >
      {children}
    </span>
  );
}
