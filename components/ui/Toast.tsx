"use client";

import * as React from "react";

type ToastTone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: ToastTone };
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

  const toast = React.useCallback((message: string, tone: ToastTone = "info") => {
    const id = idRef.current++;
    setItems((arr) => [...arr, { id, message, tone }]);
    setTimeout(() => {
      setItems((arr) => arr.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 px-4 w-full max-w-sm">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={
              "rounded-xl px-4 py-3 text-sm shadow-lg backdrop-blur " +
              (t.tone === "success"
                ? "bg-[var(--color-forest-500)] text-white"
                : t.tone === "error"
                ? "bg-[var(--color-danger-500)] text-white"
                : "bg-[var(--color-ink-900)] text-white")
            }
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
