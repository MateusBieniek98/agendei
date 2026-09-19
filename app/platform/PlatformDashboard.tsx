"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Logo from "@/components/branding/Logo";
import { PRODUCT_BRAND } from "@/lib/product-brand";

type OrganizationItem = {
  id: string;
  slug: string;
  display_name: string;
  status: string;
  plan_code: string;
  user_limit: number;
  active_users: number;
  contract_started_at: string | null;
  contract_ends_at: string | null;
  created_at: string;
};

export default function PlatformDashboard() {
  const [items, setItems] = useState<OrganizationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/platform/organizations", { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    setItems(response.ok && Array.isArray(body.items) ? body.items : []);
    if (!response.ok) setMessage(body.error ?? "Falha ao carregar empresas.");
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createOrganization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/platform/organizations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    const body = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setMessage(body.error ?? "Falha ao criar empresa.");
      return;
    }
    setMessage(body.onboarding?.message ?? "Empresa criada.");
    event.currentTarget.reset();
    await load();
  }

  async function updateStatus(id: string, status: string) {
    setMessage("");
    const response = await fetch("/api/platform/organizations", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(body.error ?? "Falha ao atualizar empresa.");
      return;
    }
    setMessage(status === "suspended" ? "Empresa suspensa e acesso operacional bloqueado." : "Status atualizado.");
    await load();
  }

  async function updateCommercial(
    id: string,
    patch: Record<string, string | number | null>
  ) {
    setMessage("");
    const response = await fetch("/api/platform/organizations", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(body.error ?? "Falha ao atualizar contrato.");
      return;
    }
    setMessage("Dados comerciais atualizados.");
    await load();
  }

  async function rotateIntegrationToken(id: string, displayName: string) {
    if (!confirm(`Gerar um novo token para ${displayName}? O token anterior deixará de funcionar.`)) return;
    const webhookUrl = window.prompt(
      "URL /exec do Apps Script (deixe vazio para manter a configuração atual):",
      ""
    );
    if (webhookUrl === null) return;
    setMessage("");
    const response = await fetch(`/api/platform/organizations/${id}/integration-token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apontamentos_webhook_url: webhookUrl.trim() }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(body.error ?? "Falha ao gerar token.");
      return;
    }
    const copied = await navigator.clipboard.writeText(String(body.token)).then(
      () => true,
      () => false
    );
    setMessage(
      copied
        ? "Token copiado. Guarde-o agora: ele não será exibido novamente."
        : `Token (copie agora): ${body.token}`
    );
  }

  return (
    <main className="min-h-dvh bg-[var(--bg-page)] px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-2xl bg-[var(--shell-bg)] p-6 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Logo size={48} variant="mono-light" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/55">Administração da plataforma</p>
              <h1 className="text-2xl font-bold">{PRODUCT_BRAND.name}</h1>
            </div>
          </div>
          <Link href="/" className="text-sm font-bold text-white/75 hover:text-white">Voltar ao app</Link>
        </header>

        {message && <p className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-sm font-semibold">{message}</p>}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <h2 className="text-lg font-bold">Empresas</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Contratos e limites são controlados manualmente no piloto.</p>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="text-xs uppercase text-[var(--text-muted)]"><tr><th className="pb-3">Empresa</th><th className="pb-3">Status</th><th className="pb-3">Plano e usuários</th><th className="pb-3">Contrato</th><th className="pb-3">Integração</th><th className="pb-3">Criada</th></tr></thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t border-[var(--border)]">
                      <td className="py-3"><p className="font-bold">{item.display_name}</p><p className="text-xs text-[var(--text-muted)]">{item.slug}</p></td>
                      <td className="py-3">
                        <select
                          aria-label={`Status de ${item.display_name}`}
                          value={item.status}
                          onChange={(event) => void updateStatus(item.id, event.target.value)}
                          className="h-9 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-2 text-xs font-bold"
                        >
                          <option value="onboarding">implantação</option>
                          <option value="active">ativa</option>
                          <option value="suspended">suspensa</option>
                          <option value="cancelled">cancelada</option>
                        </select>
                      </td>
                      <td className="py-3">
                        <input
                          aria-label={`Plano de ${item.display_name}`}
                          defaultValue={item.plan_code}
                          onBlur={(event) => {
                            if (event.target.value !== item.plan_code) void updateCommercial(item.id, { plan_code: event.target.value });
                          }}
                          className="h-8 w-24 rounded border border-[var(--border)] bg-[var(--bg-input)] px-2 text-xs"
                        />
                        <div className="mt-1 flex items-center gap-1 text-xs text-[var(--text-muted)]">
                          <span>{item.active_users}/</span>
                          <input
                            aria-label={`Limite de usuários de ${item.display_name}`}
                            type="number"
                            min={item.active_users || 1}
                            defaultValue={item.user_limit}
                            onBlur={(event) => {
                              const value = Number(event.target.value);
                              if (value !== item.user_limit) void updateCommercial(item.id, { user_limit: value });
                            }}
                            className="h-7 w-16 rounded border border-[var(--border)] bg-[var(--bg-input)] px-2 text-xs"
                          />
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="grid gap-1">
                          <input aria-label={`Início do contrato de ${item.display_name}`} type="date" defaultValue={item.contract_started_at ?? ""} onBlur={(event) => { if (event.target.value !== (item.contract_started_at ?? "")) void updateCommercial(item.id, { contract_started_at: event.target.value || null }); }} className="h-8 rounded border border-[var(--border)] bg-[var(--bg-input)] px-2 text-xs" />
                          <input aria-label={`Fim do contrato de ${item.display_name}`} type="date" defaultValue={item.contract_ends_at ?? ""} onBlur={(event) => { if (event.target.value !== (item.contract_ends_at ?? "")) void updateCommercial(item.id, { contract_ends_at: event.target.value || null }); }} className="h-8 rounded border border-[var(--border)] bg-[var(--bg-input)] px-2 text-xs" />
                        </div>
                      </td>
                      <td className="py-3"><button type="button" onClick={() => void rotateIntegrationToken(item.id, item.display_name)} className="text-xs font-bold text-[var(--accent)] hover:underline">Gerar token</button></td>
                      <td className="py-3">{new Date(item.created_at).toLocaleDateString("pt-BR")}</td>
                    </tr>
                  ))}
                  {!loading && items.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-[var(--text-muted)]">Nenhuma empresa cadastrada.</td></tr>}
                </tbody>
              </table>
              {loading && <p className="py-8 text-center text-sm text-[var(--text-muted)]">Carregando...</p>}
            </div>
          </div>

          <form onSubmit={createOrganization} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <h2 className="text-lg font-bold">Nova empresa</h2>
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-semibold">Nome operacional<input name="display_name" required className="mt-1 h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-3" /></label>
              <label className="block text-sm font-semibold">Razão social<input name="legal_name" className="mt-1 h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-3" /></label>
              <label className="block text-sm font-semibold">E-mail de cobrança<input name="billing_email" type="email" className="mt-1 h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-3" /></label>
              <label className="block text-sm font-semibold">Nome do primeiro administrador<input name="admin_name" className="mt-1 h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-3" /></label>
              <label className="block text-sm font-semibold">E-mail do primeiro administrador<input name="admin_email" type="email" className="mt-1 h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-3" /></label>
              <label className="block text-sm font-semibold">Plano<select name="plan_code" defaultValue="founder" className="mt-1 h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-3"><option value="founder">Piloto fundador</option><option value="standard">Padrão</option><option value="custom">Personalizado</option></select></label>
              <label className="block text-sm font-semibold">Início do contrato<input name="contract_started_at" type="date" className="mt-1 h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-3" /></label>
              <label className="block text-sm font-semibold">Limite de usuários<input name="user_limit" type="number" min="1" defaultValue="30" className="mt-1 h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-3" /></label>
            </div>
            <button disabled={saving} className="mt-5 h-11 w-full rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-white disabled:opacity-60">{saving ? "Criando..." : "Criar empresa"}</button>
          </form>
        </section>
      </div>
    </main>
  );
}
