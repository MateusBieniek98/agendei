"use client";

import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { buildWhatsAppShareUrl } from "@/lib/production-report";

function copyWithFallback(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Não foi possível copiar o texto.");
}

export default function ProductionReportCard({
  text,
  queued,
  onNewProduction,
}: {
  text: string;
  queued: boolean;
  onNewProduction: () => void;
}) {
  const { toast } = useToast();

  async function copyReport() {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else copyWithFallback(text);
      toast("Informativo copiado!", "success");
    } catch {
      toast("Não foi possível copiar. Use o botão do WhatsApp.", "error");
    }
  }

  function openWhatsApp() {
    window.open(buildWhatsAppShareUrl(text), "_blank", "noopener,noreferrer");
  }

  return (
    <section
      className="animate-slide-up overflow-hidden rounded-lg border shadow-sm"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
      aria-labelledby="production-report-title"
    >
      <div
        className="border-b p-4"
        style={{
          background: queued ? "var(--warn-bg)" : "var(--success-bg)",
          borderColor: queued ? "var(--warn)" : "var(--success)",
        }}
      >
        <p
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: queued ? "var(--warn)" : "var(--success)" }}
        >
          {queued ? "Salvo offline" : "Produção registrada"}
        </p>
        <h2 id="production-report-title" className="mt-1 text-lg font-bold" style={{ color: "var(--text-primary)" }}>
          Informativo pronto para o grupo
        </h2>
        <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
          {queued
            ? "O texto já pode ser enviado; o status indica que o app ainda vai sincronizar o apontamento."
            : "Revise o texto e envie para o grupo do WhatsApp."}
        </p>
      </div>

      <div className="space-y-3 p-4">
        <pre
          className="max-h-[52vh] overflow-y-auto whitespace-pre-wrap break-words rounded-lg border p-4 font-sans text-sm leading-relaxed"
          style={{
            background: "var(--bg-card-alt)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
          }}
        >
          {text}
        </pre>

        <Button type="button" size="field" onClick={openWhatsApp}>
          Enviar no WhatsApp
        </Button>
        <Button type="button" size="field" variant="secondary" onClick={copyReport}>
          Copiar informativo
        </Button>
        <button
          type="button"
          onClick={onNewProduction}
          className="w-full rounded-lg px-4 py-3 text-sm font-bold transition hover:opacity-80"
          style={{ color: "var(--text-secondary)" }}
        >
          Fazer novo lançamento
        </button>
      </div>
    </section>
  );
}
