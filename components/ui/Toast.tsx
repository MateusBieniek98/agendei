"use client";

import * as React from "react";

type ToastTone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: ToastTone; leaving: boolean };
type Ctx = { toast: (message: string, tone?: ToastTone) => void };

const ToastContext = React.createContext<Ctx | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast deve ser usado dentro de <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<Toast[]>([]);
  const idRef = React.useRef(1);

  const dismiss = React.useCallback((id: number) => {
    setItems((arr) => arr.map((item) => item.id === id ? { ...item, leaving: true } : item));
    window.setTimeout(() => {
      setItems((arr) => arr.filter((item) => item.id !== id));
    }, 220);
  }, []);

  const toast = React.useCallback((message: string, tone: ToastTone = "info") => {
    const id = idRef.current++;
    setItems((arr) => [...arr.slice(-3), { id, message, tone, leaving: false }]);
    window.setTimeout(() => dismiss(id), 3300);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-24 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            data-state={t.leaving ? "closed" : "open"}
            className={
              "toast-item pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg " +
              (t.tone === "success"
                ? "border-[color-mix(in_srgb,var(--success)_32%,transparent)] bg-[var(--success-bg)] text-[var(--success)]"
                : t.tone === "error"
                ? "border-[color-mix(in_srgb,var(--danger)_32%,transparent)] bg-[var(--danger-bg)] text-[var(--danger)]"
                : "border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text-primary)]")
            }
          >
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-current" aria-hidden="true" />
            <span className="min-w-0 flex-1 font-medium leading-relaxed">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-base leading-none opacity-65 transition-opacity hover:opacity-100"
              aria-label="Fechar aviso"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
