"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";

export default function CreateOrganizationDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open, saving]);

  if (!open) return null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/platform/organizations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Falha ao criar empresa.");
      onCreated();
      formRef.current?.reset();
      onClose();
      toast(body.onboarding?.message ?? "Empresa criada com sucesso.", "success");
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="ui-overlay fixed inset-0 z-[90] grid items-end bg-black/45 p-0 sm:place-items-center sm:p-4"
      data-state="open"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-organization-title"
        className="ui-dialog-panel max-h-[94dvh] w-full overflow-y-auto rounded-t-lg border border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl sm:max-w-3xl sm:rounded-lg"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--text-muted)]">Onboarding</p>
            <h2 id="new-organization-title" className="text-lg font-semibold">Nova empresa</h2>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Fechar
          </Button>
        </header>

        <form ref={formRef} onSubmit={submit} className="space-y-6 p-5 sm:p-6">
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Identificação</legend>
            <Input name="display_name" label="Nome operacional" required autoFocus />
            <Input name="legal_name" label="Razão social" />
            <Input name="document_number" label="CNPJ ou documento" />
            <Input name="billing_email" type="email" label="E-mail de cobrança" />
          </fieldset>

          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Contrato</legend>
            <Select
              name="plan_code"
              label="Plano"
              defaultValue="founder"
              options={[
                { value: "founder", label: "Piloto fundador" },
                { value: "standard", label: "Padrão" },
                { value: "custom", label: "Personalizado" },
              ]}
            />
            <Input name="user_limit" type="number" min="1" max="10000" defaultValue="30" label="Limite de usuários" required />
            <Input name="contract_started_at" type="date" label="Início do contrato" />
            <Input name="contract_ends_at" type="date" label="Fim do contrato" />
          </fieldset>

          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Primeiro administrador</legend>
            <Input name="admin_name" label="Nome" />
            <Input name="admin_email" type="email" label="E-mail para convite" />
          </fieldset>

          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Configuração regional</legend>
            <Input name="timezone" label="Fuso horário" defaultValue="America/Campo_Grande" />
            <Input name="locale" label="Localidade" defaultValue="pt-BR" />
            <Input name="support_email" type="email" label="E-mail de suporte" />
            <Input name="privacy_email" type="email" label="E-mail de privacidade" />
          </fieldset>

          <footer className="flex flex-col-reverse gap-2 border-t border-[var(--divider)] pt-5 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="submit" loading={saving}>Criar empresa</Button>
          </footer>
        </form>
      </section>
    </div>
  );
}
