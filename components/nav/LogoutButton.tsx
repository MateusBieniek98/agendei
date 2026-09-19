"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { getOfflineProductionSnapshot } from "@/lib/offline-production-queue";
import { clearAuthenticatedClientState } from "@/lib/logout-client";

type PendingSummary = {
  owned: number;
  unassigned: number;
};

export default function LogoutButton({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [summary, setSummary] = useState<PendingSummary>({ owned: 0, unassigned: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dialogOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    confirmButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) setDialogOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dialogOpen, pending]);

  async function finishLogout() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Não foi possível encerrar a sessão.");
      }

      await clearAuthenticatedClientState();
      router.replace("/login");
      router.refresh();
    } catch (logoutError) {
      setError((logoutError as Error).message);
      setDialogOpen(true);
      setPending(false);
    }
  }

  async function requestLogout() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const snapshot = await getOfflineProductionSnapshot();
      const nextSummary = { owned: snapshot.total, unassigned: snapshot.unassigned };
      setSummary(nextSummary);
      if (nextSummary.owned > 0 || nextSummary.unassigned > 0) {
        setDialogOpen(true);
        setPending(false);
        return;
      }
      await finishLogout();
    } catch (snapshotError) {
      setError((snapshotError as Error).message);
      setDialogOpen(true);
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        aria-busy={pending || undefined}
        onClick={() => void requestLogout()}
        className={
          className ??
          "inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm font-bold text-[var(--text-primary)] shadow-sm transition hover:bg-[var(--bg-hover)] active:scale-[0.98] disabled:opacity-60"
        }
      >
        {pending && (
          <span
            className="mr-1 h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
        )}
        {pending ? "Saindo" : children ?? "Sair"}
      </button>

      {dialogOpen && createPortal(
        <div className="fixed inset-0 z-[120] grid place-items-center bg-black/55 px-4" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-dialog-title"
            className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5 text-left shadow-xl"
          >
            <h2 id="logout-dialog-title" className="text-lg font-bold text-[var(--text-primary)]">
              Encerrar sessão neste dispositivo?
            </h2>
            {summary.owned > 0 || summary.unassigned > 0 ? (
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                Existem {summary.owned} lançamento(s) pendente(s) do seu usuário
                {summary.unassigned > 0
                  ? ` e ${summary.unassigned} lançamento(s) antigo(s) sem autoria confirmada`
                  : ""}.
                Eles permanecerão neste dispositivo e não serão enviados por outro usuário.
              </p>
            ) : (
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                Confirme para encerrar a sessão do Supabase e limpar os caches deste usuário.
              </p>
            )}
            {error && (
              <p role="alert" className="mt-3 rounded-md bg-[var(--danger-bg)] px-3 py-2 text-sm font-bold text-[var(--danger)]">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                ref={confirmButtonRef}
                type="button"
                disabled={pending}
                onClick={() => {
                  setDialogOpen(false);
                  setError(null);
                }}
                className="min-h-10 rounded-md border border-[var(--border)] px-3 text-sm font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-60"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={pending}
                aria-busy={pending || undefined}
                onClick={() => void finishLogout()}
                className="inline-flex min-h-10 items-center rounded-md bg-[var(--danger)] px-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {pending ? "Encerrando..." : "Sair mesmo assim"}
              </button>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
