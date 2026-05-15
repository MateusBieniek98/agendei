"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type SyncAction = "atualizar_apontamentos" | "rodar_fluxo_completo";
type Message = { type: "ok" | "error"; text: string };

const LAST_ADMIN_SYNC_KEY = "gn:admin:last-sheets-sync";

function formatDateTime(value: string | null) {
  if (!value) return "Ainda não executado neste dispositivo";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AdminSyncClient() {
  const [busy, setBusy] = useState<SyncAction | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    setLastSync(localStorage.getItem(LAST_ADMIN_SYNC_KEY));
  }, []);

  async function triggerSheets(action: SyncAction) {
    setBusy(action);
    setMessage(null);

    try {
      const response = await fetch("/api/sync/google-sheets/trigger", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ acao: action }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || "Falha ao sincronizar com a planilha.");
      }

      const now = new Date().toISOString();
      localStorage.setItem(LAST_ADMIN_SYNC_KEY, now);
      setLastSync(now);
      setMessage({
        type: "ok",
        text:
          action === "rodar_fluxo_completo"
            ? "Fluxo completo executado: Registro de atividades importado e Apontamentos App atualizado."
            : "Aba Apontamentos App atualizada com os apontamentos existentes no Supabase.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(null);
    }
  }

  const loading = busy !== null;

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-[var(--color-ink-900)] sm:text-3xl">
            Sincronização
          </h1>
          <p className="mt-1 max-w-3xl text-sm font-bold text-[var(--color-ink-700)] sm:text-base">
            Controle administrativo da integração entre Supabase, app e a planilha
            Controle de Produção GN.
          </p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="space-y-4 p-4 sm:p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-gn-700)]">
              Google Sheets
            </p>
            <h2 className="mt-1 text-xl font-black text-[var(--color-ink-900)]">
              Ações da planilha
            </h2>
            <p className="mt-1 text-sm font-semibold text-[var(--color-ink-700)]">
              Use estes botões quando precisar forçar a sincronização fora do
              horário automático.
            </p>
          </div>

          {message && (
            <div
              className={`rounded-2xl border-2 px-4 py-3 text-sm font-bold ${
                message.type === "ok"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : "border-red-300 bg-red-50 text-red-800"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => triggerSheets("atualizar_apontamentos")}
              className="min-h-[108px] rounded-2xl border-2 border-[var(--color-ink-200)] bg-white p-4 text-left shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="block text-lg font-black text-[var(--color-ink-900)]">
                {busy === "atualizar_apontamentos"
                  ? "Atualizando..."
                  : "Atualizar Apontamentos App"}
              </span>
              <span className="mt-2 block text-sm font-bold text-[var(--color-ink-600)]">
                Envia para a planilha tudo que já está no Supabase.
              </span>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => triggerSheets("rodar_fluxo_completo")}
              className="min-h-[108px] rounded-2xl border-2 border-[var(--color-gn-300)] bg-[var(--color-gn-50)] p-4 text-left shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="block text-lg font-black text-[var(--color-gn-800)]">
                {busy === "rodar_fluxo_completo"
                  ? "Sincronizando..."
                  : "Sincronizar planilha e app"}
              </span>
              <span className="mt-2 block text-sm font-bold text-[var(--color-gn-700)]">
                Importa Registro de atividades e depois atualiza Apontamentos App.
              </span>
            </button>
          </div>
        </Card>

        <Card className="space-y-4 p-4 sm:p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-ink-500)]">
              Diagnóstico
            </p>
            <h2 className="mt-1 text-xl font-black text-[var(--color-ink-900)]">
              Última execução manual
            </h2>
            <p className="mt-3 rounded-2xl bg-[var(--color-ink-50)] p-4 text-lg font-black text-[var(--color-ink-900)]">
              {formatDateTime(lastSync)}
            </p>
          </div>
          <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
            Se aparecer HTTP 404 com HTML do Google, a variável
            <code className="mx-1 rounded bg-white px-1">GOOGLE_SHEETS_APONTAMENTOS_WEBHOOK_URL</code>
            no Vercel está apontando para a planilha/Drive. Ela precisa ser a URL
            do Apps Script publicado como Web App, terminando em
            <code className="ml-1 rounded bg-white px-1">/exec</code>.
          </div>
          <Button
            variant="secondary"
            onClick={() => window.location.reload()}
            disabled={loading}
          >
            Recarregar tela
          </Button>
        </Card>
      </div>
    </div>
  );
}
