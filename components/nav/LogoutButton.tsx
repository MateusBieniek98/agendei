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
        "inline-flex min-h-10 items-center justify-center rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-bold text-white shadow-sm transition hover:bg-white/15 active:scale-[0.98]"
      }
    >
      {children ?? "Sair"}
    </button>
  );
}
