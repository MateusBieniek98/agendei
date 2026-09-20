"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Logo from "@/components/branding/Logo";
import LogoutButton from "@/components/nav/LogoutButton";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { PRODUCT_BRAND } from "@/lib/product-brand";
import type { OrganizationStatus } from "@/lib/types";
import CreateOrganizationDialog from "./CreateOrganizationDialog";
import OrganizationDrawer from "./OrganizationDrawer";
import type {
  PlatformAuditEntry,
  PlatformOrganization,
} from "./platform-types";

const STATUS_LABEL: Record<OrganizationStatus, string> = {
  onboarding: "Em implantação",
  active: "Ativa",
  suspended: "Suspensa",
  cancelled: "Cancelada",
};

const ACTION_LABEL: Record<string, string> = {
  "organization.created": "Empresa criada",
  "organization.updated": "Empresa atualizada",
  "organization.support_started": "Suporte iniciado",
  "organization.support_ended": "Suporte encerrado",
  "organization.integration_token_rotated": "Token de integração renovado",
  "organization.user_invited": "Usuário convidado",
  "organization.user_created_assisted": "Usuário criado",
};

function statusTone(status: OrganizationStatus) {
  if (status === "active") return "success" as const;
  if (status === "onboarding") return "info" as const;
  if (status === "suspended") return "warning" as const;
  return "danger" as const;
}

function formatDate(value: string | null, withTime = false) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

export default function PlatformDashboard() {
  const { toast } = useToast();
  const [items, setItems] = useState<PlatformOrganization[]>([]);
  const [audit, setAudit] = useState<PlatformAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    try {
      const [organizationsResponse, auditResponse] = await Promise.all([
        fetch("/api/platform/organizations", { cache: "no-store" }),
        fetch("/api/platform/audit", { cache: "no-store" }),
      ]);
      const [organizationsBody, auditBody] = await Promise.all([
        organizationsResponse.json().catch(() => ({})),
        auditResponse.json().catch(() => ({})),
      ]);
      if (!organizationsResponse.ok) {
        if (organizationsBody.next) window.location.assign(organizationsBody.next);
        throw new Error(organizationsBody.error ?? "Falha ao carregar empresas.");
      }
      if (!auditResponse.ok) {
        throw new Error(auditBody.error ?? "Falha ao carregar auditoria.");
      }
      setItems(Array.isArray(organizationsBody.items) ? organizationsBody.items : []);
      setAudit(Array.isArray(auditBody.items) ? auditBody.items : []);
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
    const params = new URLSearchParams(window.location.search);
    if (params.get("aviso") === "sessao-expirada") {
      toast("O acesso temporário à empresa expirou.", "info");
      window.history.replaceState({}, "", "/platform");
    }
  }, [load, toast]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return items.filter((item) => {
      if (status !== "all" && item.status !== status) return false;
      if (!term) return true;
      return [
        item.display_name,
        item.legal_name,
        item.document_number,
        item.slug,
      ].some((value) => value?.toLocaleLowerCase("pt-BR").includes(term));
    });
  }, [items, search, status]);

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const active = items.filter((item) => item.status === "active").length;
  const onboarding = items.filter((item) => item.status === "onboarding").length;
  const blocked = items.filter(
    (item) => item.status === "suspended" || item.status === "cancelled"
  ).length;
  const activeUsers = items.reduce((total, item) => total + item.active_users, 0);

  function updateItem(updated: PlatformOrganization) {
    setItems((current) =>
      current.map((item) => (item.id === updated.id ? updated : item))
    );
  }

  return (
    <div className="min-h-dvh bg-[var(--bg-page)] text-[var(--text-primary)]">
      <header className="border-b border-white/10 bg-[var(--shell-bg)] text-white">
        <div className="mx-auto flex min-h-[76px] max-w-[1480px] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Logo size={42} variant="mono-light" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{PRODUCT_BRAND.name} Operações</p>
            <p className="truncate text-xs text-white/50">Administração global da plataforma</p>
          </div>
          <Link
            href="/seguranca/mfa"
            className="hidden min-h-9 items-center rounded-md px-3 text-xs font-semibold text-white/65 transition hover:bg-white/10 hover:text-white sm:inline-flex"
          >
            Segurança
          </Link>
          <LogoutButton className="inline-flex min-h-9 items-center rounded-md px-3 text-xs font-semibold text-white/65 transition hover:bg-white/10 hover:text-white">
            Sair
          </LogoutButton>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1480px] space-y-6 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--text-muted)]">Ambiente global</p>
            <h1 className="mt-1 text-2xl font-semibold">Empresas</h1>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              loading={refreshing}
              onClick={() => void load(true)}
            >
              Atualizar
            </Button>
            <Button type="button" onClick={() => setCreateOpen(true)}>
              Nova empresa
            </Button>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Empresas" value={items.length} hint="Total cadastrado" />
          <StatCard label="Ativas" value={active} hint="Operação liberada" tone="positive" />
          <StatCard label="Em implantação" value={onboarding} hint="Onboarding em curso" tone="warning" />
          <StatCard label="Usuários ativos" value={activeUsers} hint={`${blocked} empresas bloqueadas`} />
        </section>

        <Card>
          <CardHeader
            title="Carteira de clientes"
            subtitle={`${filtered.length} de ${items.length} empresas`}
            right={refreshing ? <span className="ui-spinner h-4 w-4" aria-label="Atualizando" /> : undefined}
          />
          <CardBody className="border-b border-[var(--divider)]">
            <div className="grid gap-3 sm:grid-cols-[minmax(240px,1fr)_220px]">
              <Input
                type="search"
                aria-label="Buscar empresa"
                placeholder="Buscar por nome, CNPJ ou identificador"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <Select
                aria-label="Filtrar por status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                options={[
                  { value: "all", label: "Todos os status" },
                  { value: "active", label: "Ativas" },
                  { value: "onboarding", label: "Em implantação" },
                  { value: "suspended", label: "Suspensas" },
                  { value: "cancelled", label: "Canceladas" },
                ]}
              />
            </div>
          </CardBody>

          <div className="divide-y divide-[var(--divider)] sm:hidden">
            {filtered.map((item) => (
              <article key={item.id} className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--text-primary)]">{item.display_name}</p>
                    <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                      {item.document_number || item.slug}
                    </p>
                  </div>
                  <Badge tone={statusTone(item.status)}>{STATUS_LABEL[item.status]}</Badge>
                </div>
                <dl className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <dt className="text-[var(--text-muted)]">Plano</dt>
                    <dd className="mt-1 font-semibold text-[var(--text-primary)]">{item.plan_code}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--text-muted)]">Usuários</dt>
                    <dd className="mt-1 font-semibold tabular-nums text-[var(--text-primary)]">
                      {item.active_users} / {item.user_limit}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--text-muted)]">Contrato</dt>
                    <dd className="mt-1 font-semibold text-[var(--text-primary)]">
                      {item.contract_ends_at
                        ? formatDate(item.contract_ends_at)
                        : item.contract_started_at
                          ? formatDate(item.contract_started_at)
                          : "Não informado"}
                    </dd>
                  </div>
                </dl>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => setSelectedId(item.id)}
                >
                  Gerenciar empresa
                </Button>
              </article>
            ))}
            {!loading && filtered.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                Nenhuma empresa encontrada.
              </p>
            )}
            {loading && <TableSkeleton rows={4} columns={2} className="m-4" />}
          </div>

          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-[var(--bg-card-alt)] text-[11px] font-semibold uppercase text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Plano</th>
                  <th className="px-4 py-3">Usuários</th>
                  <th className="px-4 py-3">Contrato</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--divider)]">
                {filtered.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-[var(--bg-hover)]">
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-[var(--text-primary)]">{item.display_name}</p>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {item.document_number || item.slug}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge tone={statusTone(item.status)}>{STATUS_LABEL[item.status]}</Badge>
                    </td>
                    <td className="px-4 py-3.5"><p className="font-medium">{item.plan_code}</p></td>
                    <td className="px-4 py-3.5 tabular-nums">
                      <span className="font-semibold">{item.active_users}</span>
                      <span className="text-[var(--text-muted)]"> / {item.user_limit}</span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[var(--text-secondary)]">
                      {item.contract_ends_at
                        ? `até ${formatDate(item.contract_ends_at)}`
                        : item.contract_started_at
                          ? `desde ${formatDate(item.contract_started_at)}`
                          : "Não informado"}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex justify-end">
                        <Button type="button" variant="secondary" size="sm" onClick={() => setSelectedId(item.id)}>Gerenciar</Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-[var(--text-muted)]">Nenhuma empresa encontrada.</td></tr>
                )}
              </tbody>
            </table>
            {loading && <TableSkeleton rows={6} columns={6} className="m-4" />}
          </div>
        </Card>

        <Card>
          <CardHeader title="Atividade da plataforma" subtitle="Últimas 60 operações administrativas" />
          <div className="divide-y divide-[var(--divider)] sm:hidden">
            {audit.map((entry) => (
              <article key={entry.id} className="space-y-2 p-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-[var(--text-primary)]">
                    {ACTION_LABEL[entry.action] ?? entry.action}
                  </p>
                  <time className="shrink-0 text-xs text-[var(--text-muted)]">
                    {formatDate(entry.created_at, true)}
                  </time>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  {entry.organization_name} · {entry.actor_name}
                </p>
              </article>
            ))}
            {!loading && audit.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                Nenhuma operação registrada.
              </p>
            )}
            {loading && <TableSkeleton rows={3} columns={2} className="m-4" />}
          </div>

          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[var(--bg-card-alt)] text-[11px] font-semibold uppercase text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Operação</th>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Responsável</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--divider)]">
                {audit.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--text-muted)]">{formatDate(entry.created_at, true)}</td>
                    <td className="px-4 py-3 font-medium">{ACTION_LABEL[entry.action] ?? entry.action}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{entry.organization_name}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{entry.actor_name}</td>
                  </tr>
                ))}
                {!loading && audit.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-10 text-center text-[var(--text-muted)]">Nenhuma operação registrada.</td></tr>
                )}
              </tbody>
            </table>
            {loading && <TableSkeleton rows={4} columns={4} className="m-4" />}
          </div>
        </Card>
      </main>

      <CreateOrganizationDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void load(true)}
      />
      <OrganizationDrawer
        organization={selected}
        onClose={() => setSelectedId(null)}
        onUpdated={updateItem}
      />
    </div>
  );
}
