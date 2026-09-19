"use client";

import { useState } from "react";

export default function LogoutButton({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const [pending, setPending] = useState(false);

  return (
    <a
      href="/api/auth/logout"
      aria-busy={pending || undefined}
      onClick={() => setPending(true)}
      className={
        className ??
        "inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm font-bold text-[var(--text-primary)] shadow-sm transition hover:bg-[var(--bg-hover)] active:scale-[0.98]"
      }
    >
      {pending && <span className="ui-spinner mr-1 h-3.5 w-3.5" aria-hidden="true" />}
      {pending ? "Saindo" : children ?? "Sair"}
    </a>
  );
}
