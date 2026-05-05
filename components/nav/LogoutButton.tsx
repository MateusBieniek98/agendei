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
      onClick={() => {
        window.location.href = "/api/auth/logout";
      }}
      className={
        className ??
        "text-sm text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]"
      }
    >
      {children ?? "Sair"}
    </button>
  );
}
