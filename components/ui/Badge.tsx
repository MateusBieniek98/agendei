import * as React from "react";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-[var(--bg-active)] text-[var(--text-secondary)]",
  success: "bg-[var(--success-bg)] text-[var(--success)]",
  warning: "bg-[var(--warn-bg)] text-[var(--warn)]",
  danger: "bg-[var(--danger-bg)] text-[var(--danger)]",
  info: "bg-[var(--accent-subtle)] text-[var(--accent)]",
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
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold " +
        tones[tone]
      }
    >
      {children}
    </span>
  );
}
