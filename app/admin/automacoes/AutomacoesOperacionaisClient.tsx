"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import {
  AUTOMATION_RULE_ORDER,
  DEFAULT_OPERATIONAL_AUTOMATIONS,
  type AutomationRuleId,
  type AutomationRuleParams,
  type AutomationSeverity,
  type OperationalAutomationRule,
  type OperationalAutomationSettings,
} from "@/lib/operational-automations";

type RuleStatus = AutomationSeverity | "ok" | "disabled";
type LoadState = "loading" | "idle" | "saving" | "error" | "saved";

type AutomationOccurrence = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  href: string;
};

type RuleEvaluation = {
  rule: OperationalAutomationRule;
  status: RuleStatus;
  count: number;
  href: string;
  occurrences: AutomationOccurrence[];
};

type AutomationsPayload = {
  generatedAt: string;
  today: string;
  phonePushReady: boolean;
  settings: OperationalAutomationSettings;
  summary?: {
    critical: number;
    warning: number;
    info: number;
    ok: number;
    disabled: number;
  };
  rules: RuleEvaluation[];
};

type ParamMeta = {
  key: keyof AutomationRuleParams;
  label: string;
  suffix: string;
  min: number;
  max: number;
};

const PARAM_META: Record<AutomationRuleId, ParamMeta> = {
  planejamento_atrasado: {
    key: "daysTolerance",
    label: "Tolerância",
    suffix: "dias",
    min: 0,
    max: 15,
  },
  manutencao_sla: {
    key: "slaHours",
    label: "SLA",
    suffix: "h",
    min: 1,
    max: 168,
  },
  equipe_sem_lancamento: {
    key: "notifyAfterHour",
    label: "Após",
    suffix: "h",
    min: 0,
    max: 23,
  },
  sync_pendente: {
    key: "minAttempts",
    label: "Tentativas",
    suffix: "+",
    min: 0,
    max: 20,
  },
};

const STATUS_META: Record<RuleStatus, { label: string; color: string; bg: string }> = {
  critical: {
    label: "Crítico",
    color: "var(--danger)",
    bg: "var(--danger-bg)",
  },
  warning: {
    label: "Atenção",
    color: "var(--warn)",
    bg: "var(--warn-bg)",
  },
  info: {
    label: "Info",
    color: "var(--accent)",
    bg: "var(--accent-subtle)",
  },
  ok: {
    label: "OK",
    color: "var(--success)",
    bg: "var(--success-bg)",
  },
  disabled: {
    label: "Off",
    color: "var(--text-muted)",
    bg: "var(--bg-card-alt)",
  },
};

function cloneSettings(settings: OperationalAutomationSettings): OperationalAutomationSettings {
  return {
    quietHours: { ...settings.quietHours },
    rules: {
      planejamento_atrasado: {
        ...settings.rules.planejamento_atrasado,
        channels: { ...settings.rules.planejamento_atrasado.channels },
        params: { ...settings.rules.planejamento_atrasado.params },
      },
      manutencao_sla: {
        ...settings.rules.manutencao_sla,
        channels: { ...settings.rules.manutencao_sla.channels },
        params: { ...settings.rules.manutencao_sla.params },
      },
      equipe_sem_lancamento: {
        ...settings.rules.equipe_sem_lancamento,
        channels: { ...settings.rules.equipe_sem_lancamento.channels },
        params: { ...settings.rules.equipe_sem_lancamento.params },
      },
      sync_pendente: {
        ...settings.rules.sync_pendente,
        channels: { ...settings.rules.sync_pendente.channels },
        params: { ...settings.rules.sync_pendente.params },
      },
    },
  };
}

function StatusBadge({ status }: { status: RuleStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-black"
      style={{ color: meta.color, background: meta.bg }}
    >
      {meta.label}
    </span>
  );
}

function Toggle({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      className={
        "inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-xs font-black " +
        (disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer")
      }
      style={{
        borderColor: checked ? "var(--accent)" : "var(--border)",
        background: checked ? "var(--accent-subtle)" : "var(--bg-card-alt)",
        color: checked ? "var(--accent)" : "var(--text-secondary)",
      }}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        className="grid h-5 w-9 place-items-center rounded-full p-0.5"
        style={{ background: checked ? "var(--accent)" : "var(--border)" }}
        aria-hidden
      >
        <span
          className={
            "h-4 w-4 rounded-full bg-white transition " +
            (checked ? "translate-x-2" : "-translate-x-2")
          }
        />
      </span>
      {label}
    </label>
  );
}

export default function AutomacoesOperacionaisClient() {
  const [payload, setPayload] = useState<AutomationsPayload | null>(null);
  const [settings, setSettings] = useState<OperationalAutomationSettings>(
    DEFAULT_OPERATIONAL_AUTOMATIONS
  );
  const [state, setState] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setState((current) => (current === "saving" ? current : "loading"));
    setMessage("");
    try {
      const res = await fetch("/api/automacoes/operacionais", {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao carregar automações.");
      setPayload(json);
      setSettings(cloneSettings(json.settings ?? DEFAULT_OPERATIONAL_AUTOMATIONS));
      setState("idle");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Falha ao carregar automações.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rules = useMemo(() => {
    const current = payload?.rules ?? [];
    const byId = new Map(current.map((item) => [item.rule.id, item]));
    return AUTOMATION_RULE_ORDER.map((id) => {
      const evaluated = byId.get(id);
      if (evaluated) return evaluated;
      const rule = settings.rules[id];
      return {
        rule,
        status: rule.enabled ? "ok" : "disabled",
        count: 0,
        href: "/admin",
        occurrences: [],
      } satisfies RuleEvaluation;
    });
  }, [payload?.rules, settings.rules]);

  const totals = useMemo(() => {
    return rules.reduce(
      (acc, item) => {
        if (item.status === "critical") acc.critical += item.count;
        if (item.status === "warning") acc.warning += item.count;
        if (item.status === "info") acc.info += item.count;
        if (item.status === "disabled") acc.disabled += 1;
        return acc;
      },
      { critical: 0, warning: 0, info: 0, disabled: 0 }
    );
  }, [rules]);

  function updateRule(id: AutomationRuleId, patch: Partial<OperationalAutomationRule>) {
    setSettings((current) => {
      const next = cloneSettings(current);
      next.rules[id] = { ...next.rules[id], ...patch };
      return next;
    });
    if (state === "saved" || state === "error") {
      setState("idle");
      setMessage("");
    }
  }

  function updateParam(id: AutomationRuleId, value: number) {
    const meta = PARAM_META[id];
    const safeValue = Math.min(Math.max(value, meta.min), meta.max);
    setSettings((current) => {
      const next = cloneSettings(current);
      next.rules[id].params = {
        ...next.rules[id].params,
        [meta.key]: safeValue,
      };
      return next;
    });
    if (state === "saved" || state === "error") {
      setState("idle");
      setMessage("");
    }
  }

  function updateChannel(
    id: AutomationRuleId,
    channel: "inApp" | "phone",
    value: boolean
  ) {
    setSettings((current) => {
      const next = cloneSettings(current);
      next.rules[id].channels[channel] = value;
      return next;
    });
    if (state === "saved" || state === "error") {
      setState("idle");
      setMessage("");
    }
  }

  function updateQuietHours(
    patch: Partial<OperationalAutomationSettings["quietHours"]>
  ) {
    setSettings((current) => {
      const next = cloneSettings(current);
      next.quietHours = { ...next.quietHours, ...patch };
      return next;
    });
    if (state === "saved" || state === "error") {
      setState("idle");
      setMessage("");
    }
  }

  async function save() {
    setState("saving");
    setMessage("");
    const res = await fetch("/api/automacoes/operacionais", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      setState("error");
      setMessage(json.error ?? "Falha ao salvar automações.");
      return;
    }

    setPayload(json);
    setSettings(cloneSettings(json.settings ?? settings));
    setState("saved");
    setMessage("Automações atualizadas.");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-normal text-[var(--accent)]">
            Operação
          </p>
          <h1 className="text-2xl font-black tracking-normal md:text-3xl">
            Automações
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={load} disabled={state === "loading"}>
            Atualizar
          </Button>
          <Button type="button" onClick={save} loading={state === "saving"}>
            Salvar regras
          </Button>
        </div>
      </div>

      {message && (
        <div
          className="rounded-xl border px-4 py-3 text-sm font-black"
          style={{
            borderColor: state === "saved" ? "var(--success)" : "var(--danger)",
            background: state === "saved" ? "var(--success-bg)" : "var(--danger-bg)",
            color: state === "saved" ? "var(--success)" : "var(--danger)",
          }}
        >
          {message}
        </div>
      )}

      <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <SummaryCard label="Críticas" value={totals.critical} status="critical" />
        <SummaryCard label="Atenção" value={totals.warning} status="warning" />
        <SummaryCard label="Info" value={totals.info} status="info" />
        <SummaryCard label="Off" value={totals.disabled} status="disabled" />
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.72fr)]">
        <section className="gn-card overflow-hidden">
          <div
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: "var(--border)" }}
          >
            <h2 className="text-sm font-black">Regras programáveis</h2>
            <span className="text-xs font-bold text-[var(--text-muted)]">
              {rules.length}
            </span>
          </div>

          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {rules.map((evaluation) => (
              <RuleRow
                key={evaluation.rule.id}
                evaluation={evaluation}
                settingsRule={settings.rules[evaluation.rule.id]}
                phonePushReady={Boolean(payload?.phonePushReady)}
                onEnabled={(enabled) => updateRule(evaluation.rule.id, { enabled })}
                onParam={(value) => updateParam(evaluation.rule.id, value)}
                onChannel={(channel, value) =>
                  updateChannel(evaluation.rule.id, channel, value)
                }
              />
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="gn-card overflow-hidden">
            <div
              className="flex items-center justify-between border-b px-4 py-3"
              style={{ borderColor: "var(--border)" }}
            >
              <h2 className="text-sm font-black">Ocorrências</h2>
              <span className="text-xs font-bold text-[var(--text-muted)]">
                {payload?.generatedAt
                  ? new Date(payload.generatedAt).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "--:--"}
              </span>
            </div>
            <div className="max-h-[32rem] space-y-3 overflow-y-auto p-3">
              {state === "loading" && (
                <p className="rounded-lg border border-dashed p-3 text-sm font-bold text-[var(--text-muted)]">
                  Carregando...
                </p>
              )}
              {state !== "loading" &&
                rules.every((item) => item.occurrences.length === 0) && (
                  <p className="rounded-lg border border-dashed p-3 text-sm font-bold text-[var(--text-muted)]">
                    Sem ocorrências ativas.
                  </p>
                )}
              {rules.map((item) =>
                item.occurrences.length > 0 ? (
                  <div key={item.rule.id} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-black text-[var(--text-secondary)]">
                        {item.rule.title}
                      </p>
                      <StatusBadge status={item.status} />
                    </div>
                    {item.occurrences.map((occurrence) => (
                      <Link
                        key={occurrence.id}
                        href={occurrence.href}
                        className="block rounded-lg border p-3 transition hover:opacity-80"
                        style={{
                          borderColor: "var(--border)",
                          background: "var(--bg-card-alt)",
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 text-sm font-black">
                            {occurrence.title}
                          </p>
                          <span className="shrink-0 text-[11px] font-black text-[var(--text-muted)]">
                            {occurrence.meta}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs font-bold text-[var(--text-secondary)]">
                          {occurrence.subtitle}
                        </p>
                      </Link>
                    ))}
                  </div>
                ) : null
              )}
            </div>
          </section>

          <section className="gn-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-black">Telefone</h2>
                <p className="mt-1 text-xs font-bold text-[var(--text-secondary)]">
                  {payload?.phonePushReady
                    ? "Push liberado no servidor."
                    : "Push aguardando chaves do servidor."}
                </p>
              </div>
              <StatusBadge status={payload?.phonePushReady ? "ok" : "disabled"} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="text-xs font-bold text-[var(--text-secondary)]">
                Silêncio
                <div className="mt-2">
                  <Toggle
                    checked={settings.quietHours.enabled}
                    label="Ativo"
                    onChange={(enabled) => updateQuietHours({ enabled })}
                  />
                </div>
              </div>
              <label className="text-xs font-bold text-[var(--text-secondary)]">
                Início
                <input
                  type="time"
                  value={settings.quietHours.start}
                  onChange={(event) => updateQuietHours({ start: event.target.value })}
                  className="mt-2 h-11 w-full rounded-lg border px-2 text-sm font-black"
                />
              </label>
              <label className="text-xs font-bold text-[var(--text-secondary)]">
                Fim
                <input
                  type="time"
                  value={settings.quietHours.end}
                  onChange={(event) => updateQuietHours({ end: event.target.value })}
                  className="mt-2 h-11 w-full rounded-lg border px-2 text-sm font-black"
                />
              </label>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  status,
}: {
  label: string;
  value: number;
  status: RuleStatus;
}) {
  const meta = STATUS_META[status];
  return (
    <div
      className="rounded-xl border p-3"
      style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
    >
      <p className="text-xs font-black text-[var(--text-secondary)]">{label}</p>
      <p className="mt-1 text-2xl font-black" style={{ color: meta.color }}>
        {value}
      </p>
    </div>
  );
}

function RuleRow({
  evaluation,
  settingsRule,
  phonePushReady,
  onEnabled,
  onParam,
  onChannel,
}: {
  evaluation: RuleEvaluation;
  settingsRule: OperationalAutomationRule;
  phonePushReady: boolean;
  onEnabled: (value: boolean) => void;
  onParam: (value: number) => void;
  onChannel: (channel: "inApp" | "phone", value: boolean) => void;
}) {
  const rule = settingsRule;
  const meta = PARAM_META[rule.id];
  const paramValue = Number(rule.params[meta.key] ?? 0);

  return (
    <article className="grid gap-3 p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={evaluation.status} />
          <h3 className="text-sm font-black">{rule.title}</h3>
          {evaluation.count > 0 && (
            <span className="text-xs font-black text-[var(--text-muted)]">
              {evaluation.count}
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-xs font-bold text-[var(--text-secondary)]">
          {rule.triggerLabel} · {rule.actionLabel}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Toggle checked={rule.enabled} label="Ativa" onChange={onEnabled} />
        <label className="min-w-28 text-xs font-bold text-[var(--text-secondary)]">
          {meta.label}
          <div className="mt-1 flex h-11 items-center overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-input)]">
            <input
              type="number"
              min={meta.min}
              max={meta.max}
              value={paramValue}
              onChange={(event) => onParam(Number(event.target.value))}
              className="h-full w-16 border-0 bg-transparent px-2 text-sm font-black outline-none"
            />
            <span className="px-2 text-xs font-black text-[var(--text-muted)]">
              {meta.suffix}
            </span>
          </div>
        </label>
        <Toggle
          checked={rule.channels.inApp}
          label="App"
          onChange={(value) => onChannel("inApp", value)}
        />
        <Toggle
          checked={rule.channels.phone}
          disabled={!phonePushReady}
          label="Telefone"
          onChange={(value) => onChannel("phone", value)}
        />
      </div>
    </article>
  );
}
