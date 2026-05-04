import * as React from "react";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-[var(--color-ink-100)] text-[var(--color-ink-700)]",
  success: "bg-[var(--color-forest-100)] text-[var(--color-forest-700)]",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-700",
  info: "bg-[var(--color-gn-100)] text-[var(--color-gn-700)]",
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
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium " +
        tones[tone]
      }
    >
      {children}
    </span>
  );
}
