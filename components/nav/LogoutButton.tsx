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
        "inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm font-bold text-[var(--text-primary)] shadow-sm transition hover:bg-[var(--bg-hover)] active:scale-[0.98]"
      }
    >
      {children ?? "Sair"}
    </button>
  );
}
