"use client";

export default function LogoutButton({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        window.location.href = "/api/auth/logout";
      }}
      className={
        className ??
        "inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm font-bold text-[var(--text-primary)] shadow-sm transition active:scale-[0.98]"
      }
    >
      {children ?? "Sair"}
    </button>
  );
}
