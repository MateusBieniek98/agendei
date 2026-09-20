"use client";

import { useEffect, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import type { OrganizationStatus } from "@/lib/types";
import type { PlatformOrganization } from "./platform-types";

const STATUS_OPTIONS = [
  { value: "onboarding", label: "Em implantação" },
  { value: "active", label: "Ativa" },
  { value: "suspended", label: "Suspensa" },
  { value: "cancelled", label: "Cancelada" },
];

function statusTone(status: OrganizationStatus) {
  if (status === "active") return "success" as const;
  if (status === "onboarding") return "info" as const;
  if (status === "suspended") return "warning" as const;
  return "danger" as const;
}

function statusLabel(status: OrganizationStatus) {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label ?? status;
}

export default function OrganizationDrawer({
  organization,
  onClose,
  onUpdated,
}: {
  organization: PlatformOrganization | null;
  onClose: () => void;
  onUpdated: (item: PlatformOrganization) => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [startingSupport, setStartingSupport] = useState(false);
  const [rotatingToken, setRotatingToken] = useState(false);
  const [supportReason, setSupportReason] = useState("");
  const [supportDuration, setSupportDuration] = useState("60");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [oneTimeToken, setOneTimeToken] = useState("");

  useEffect(() => {
    if (!organization) return;
    setSupportReason("");
    setSupportDuration("60");
    setWebhookUrl(organization.integration?.webhook_url ?? "");
    setOneTimeToken("");
  }, [organization]);

  useEffect(() => {
    if (!organization) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving && !startingSupport) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, organization, saving, startingSupport]);

  if (!organization) return null;
  const activeOrganization = organization;

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = Object.fromEntries(new FormData(event.currentTarget));
      const response = await fetch("/api/platform/organizations", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: activeOrganization.id, ...payload }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Falha ao atualizar empresa.");
      onUpdated({ ...activeOrganization, ...body.item });
      toast("Empresa atualizada.", "success");
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function startSupport() {
    if (supportReason.trim().length < 8) {
      toast("Informe o motivo do acesso com pelo menos 8 caracteres.", "error");
      return;
    }
    setStartingSupport(true);
    try {
      const response = await fetch(
        `/api/platform/organizations/${activeOrganization.id}/support`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            reason: supportReason.trim(),
            duration_minutes: Number(supportDuration),
          }),
        }
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Falha ao iniciar suporte.");
      window.location.assign(body.next ?? "/admin");
    } catch (error) {
      setStartingSupport(false);
      toast((error as Error).message, "error");
    }
  }

  async function rotateToken() {
    if (!window.confirm(`Gerar um novo token para ${activeOrganization.display_name}?`)) return;
    setRotatingToken(true);
    setOneTimeToken("");
    try {
      const response = await fetch(
        `/api/platform/organizations/${activeOrganization.id}/integration-token`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ apontamentos_webhook_url: webhookUrl.trim() }),
        }
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Falha ao gerar token.");
      setOneTimeToken(String(body.token ?? ""));
      await navigator.clipboard.writeText(String(body.token ?? "")).catch(() => undefined);
      toast("Novo token gerado e copiado.", "success");
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setRotatingToken(false);
    }
  }

  return (
    <div
      className="ui-overlay fixed inset-0 z-[90] bg-black/45"
      data-state="open"
      data-side="right"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving && !startingSupport) onClose();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="organization-drawer-title"
        className="ui-drawer-panel ml-auto flex h-full w-full flex-col border-l border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl sm:max-w-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-xs font-semibold uppercase text-[var(--text-muted)]">{organization.slug}</p>
              <Badge tone={statusTone(organization.status)}>{statusLabel(organization.status)}</Badge>
            </div>
            <h2 id="organization-drawer-title" className="mt-1 truncate text-xl font-semibold">
              {organization.display_name}
            </h2>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving || startingSupport}>
            Fechar
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto">
          <section className="border-b border-[var(--divider)] bg-[var(--warn-bg)] px-4 py-5 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label htmlFor="support-reason" className="text-sm font-medium text-[var(--text-primary)]">Motivo do acesso de suporte</label>
                <textarea
                  id="support-reason"
                  value={supportReason}
                  onChange={(event) => setSupportReason(event.target.value.slice(0, 500))}
                  rows={2}
                  placeholder="Ex.: chamado 1042, ajuste solicitado pelo cliente"
                  className="mt-1.5 w-full resize-none rounded-md border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-sm outline-none focus:border-[var(--border-focus)] focus:ring-3 focus:ring-[var(--accent-subtle)]"
                />
              </div>
              <Select
                label="Duração"
                value={supportDuration}
                onChange={(event) => setSupportDuration(event.target.value)}
                className="sm:w-32"
                options={[
                  { value: "30", label: "30 min" },
                  { value: "60", label: "1 hora" },
                  { value: "120", label: "2 horas" },
                ]}
              />
              <Button type="button" loading={startingSupport} onClick={() => void startSupport()} className="sm:mb-0.5">
                Acessar empresa
              </Button>
            </div>
          </section>

          <form key={organization.id} onSubmit={save} className="space-y-7 px-4 py-6 sm:px-6">
            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="mb-3 text-sm font-semibold">Identificação</legend>
              <Input name="display_name" label="Nome operacional" defaultValue={organization.display_name} required />
              <Input name="legal_name" label="Razão social" defaultValue={organization.legal_name ?? ""} />
              <Input name="document_number" label="CNPJ ou documento" defaultValue={organization.document_number ?? ""} />
              <Input name="billing_email" type="email" label="E-mail de cobrança" defaultValue={organization.billing_email ?? ""} />
            </fieldset>

            <fieldset className="grid gap-4 border-t border-[var(--divider)] pt-6 sm:grid-cols-2">
              <legend className="mb-3 text-sm font-semibold">Contrato e acesso</legend>
              <Select name="status" label="Status" defaultValue={organization.status} options={STATUS_OPTIONS} />
              <Input name="suspended_reason" label="Motivo da suspensão" defaultValue={organization.suspended_reason ?? ""} />
              <Select
                name="plan_code"
                label="Plano"
                defaultValue={organization.plan_code}
                options={[
                  { value: "founder", label: "Piloto fundador" },
                  { value: "standard", label: "Padrão" },
                  { value: "custom", label: "Personalizado" },
                ]}
              />
              <Input name="user_limit" type="number" min={organization.active_users || 1} max="10000" label="Limite de usuários" defaultValue={organization.user_limit} required hint={`${organization.active_users} usuários ativos`} />
              <Input name="contract_started_at" type="date" label="Início do contrato" defaultValue={organization.contract_started_at ?? ""} />
              <Input name="contract_ends_at" type="date" label="Fim do contrato" defaultValue={organization.contract_ends_at ?? ""} />
            </fieldset>

            <fieldset className="grid gap-4 border-t border-[var(--divider)] pt-6 sm:grid-cols-2">
              <legend className="mb-3 text-sm font-semibold">Configuração da empresa</legend>
              <Input name="operational_name" label="Nome interno" defaultValue={organization.settings?.operational_name ?? organization.display_name} />
              <Input name="timezone" label="Fuso horário" defaultValue={organization.settings?.timezone ?? "America/Campo_Grande"} />
              <Input name="locale" label="Localidade" defaultValue={organization.settings?.locale ?? "pt-BR"} />
              <Input name="support_email" type="email" label="E-mail de suporte" defaultValue={organization.settings?.support_email ?? ""} />
              <Input name="privacy_email" type="email" label="E-mail de privacidade" defaultValue={organization.settings?.privacy_email ?? ""} />
            </fieldset>

            <section className="border-t border-[var(--divider)] pt-6">
              <h3 className="text-sm font-semibold">Integração de apontamentos</h3>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Input
                    label="URL do Apps Script"
                    value={webhookUrl}
                    onChange={(event) => setWebhookUrl(event.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                  />
                </div>
                <Button type="button" variant="secondary" loading={rotatingToken} onClick={() => void rotateToken()}>
                  Gerar novo token
                </Button>
              </div>
              {oneTimeToken && (
                <div className="mt-3 rounded-md border border-[var(--warn)] bg-[var(--warn-bg)] p-3">
                  <p className="text-xs font-semibold text-[var(--warn)]">Token exibido uma única vez</p>
                  <code className="mt-1 block break-all text-xs text-[var(--text-primary)]">{oneTimeToken}</code>
                </div>
              )}
            </section>

            <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-[var(--divider)] bg-[var(--bg-elevated)] py-4">
              <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
              <Button type="submit" loading={saving}>Salvar alterações</Button>
            </footer>
          </form>
        </div>
      </aside>
    </div>
  );
}
