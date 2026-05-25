export type AutomationSeverity = "critical" | "warning" | "info";
export type AutomationRuleId =
  | "planejamento_atrasado"
  | "manutencao_sla"
  | "equipe_sem_lancamento"
  | "sync_pendente";

export type AutomationChannels = {
  inApp: boolean;
  phone: boolean;
};

export type AutomationRuleParams = {
  daysTolerance?: number;
  slaHours?: number;
  notifyAfterHour?: number;
  minAttempts?: number;
};

export type OperationalAutomationRule = {
  id: AutomationRuleId;
  enabled: boolean;
  title: string;
  triggerLabel: string;
  actionLabel: string;
  severity: AutomationSeverity;
  channels: AutomationChannels;
  params: AutomationRuleParams;
};

export type QuietHoursSettings = {
  enabled: boolean;
  start: string;
  end: string;
};

export type OperationalAutomationSettings = {
  quietHours: QuietHoursSettings;
  rules: Record<AutomationRuleId, OperationalAutomationRule>;
};

export const OPERATIONAL_AUTOMATIONS_KEY = "operational_automations";

export const AUTOMATION_RULE_ORDER: AutomationRuleId[] = [
  "planejamento_atrasado",
  "manutencao_sla",
  "equipe_sem_lancamento",
  "sync_pendente",
];

export const DEFAULT_OPERATIONAL_AUTOMATIONS: OperationalAutomationSettings = {
  quietHours: {
    enabled: true,
    start: "20:00",
    end: "06:00",
  },
  rules: {
    planejamento_atrasado: {
      id: "planejamento_atrasado",
      enabled: true,
      title: "Planejamento atrasado",
      triggerLabel: "Itens vencidos no ciclo",
      actionLabel: "Revisar plano",
      severity: "critical",
      channels: { inApp: true, phone: false },
      params: { daysTolerance: 0 },
    },
    manutencao_sla: {
      id: "manutencao_sla",
      enabled: true,
      title: "Manutenção acima do SLA",
      triggerLabel: "OS aberta por muitas horas",
      actionLabel: "Priorizar manutenção",
      severity: "warning",
      channels: { inApp: true, phone: false },
      params: { slaHours: 24 },
    },
    equipe_sem_lancamento: {
      id: "equipe_sem_lancamento",
      enabled: true,
      title: "Equipe sem lançamento",
      triggerLabel: "Sem produção lançada hoje",
      actionLabel: "Cobrar apontamento",
      severity: "warning",
      channels: { inApp: true, phone: false },
      params: { notifyAfterHour: 16 },
    },
    sync_pendente: {
      id: "sync_pendente",
      enabled: true,
      title: "Sync pendente ou com erro",
      triggerLabel: "Fila externa não concluiu",
      actionLabel: "Verificar sincronização",
      severity: "info",
      channels: { inApp: true, phone: false },
      params: { minAttempts: 1 },
    },
  },
};

function boolOrDefault(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function numberInRange(
  value: unknown,
  fallback: number,
  min: number,
  max: number
) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.round(parsed), min), max);
}

function timeOrDefault(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  return /^\d{2}:\d{2}$/.test(value) ? value : fallback;
}

function normalizeRule(
  id: AutomationRuleId,
  source: unknown
): OperationalAutomationRule {
  const fallback = DEFAULT_OPERATIONAL_AUTOMATIONS.rules[id];
  const raw =
    source && typeof source === "object"
      ? (source as Record<string, unknown>)
      : {};
  const rawChannels =
    raw.channels && typeof raw.channels === "object"
      ? (raw.channels as Record<string, unknown>)
      : {};
  const rawParams =
    raw.params && typeof raw.params === "object"
      ? (raw.params as Record<string, unknown>)
      : {};

  const params: AutomationRuleParams = {};
  if ("daysTolerance" in fallback.params) {
    params.daysTolerance = numberInRange(
      rawParams.daysTolerance,
      fallback.params.daysTolerance ?? 0,
      0,
      15
    );
  }
  if ("slaHours" in fallback.params) {
    params.slaHours = numberInRange(
      rawParams.slaHours,
      fallback.params.slaHours ?? 24,
      1,
      168
    );
  }
  if ("notifyAfterHour" in fallback.params) {
    params.notifyAfterHour = numberInRange(
      rawParams.notifyAfterHour,
      fallback.params.notifyAfterHour ?? 16,
      0,
      23
    );
  }
  if ("minAttempts" in fallback.params) {
    params.minAttempts = numberInRange(
      rawParams.minAttempts,
      fallback.params.minAttempts ?? 1,
      0,
      20
    );
  }

  return {
    ...fallback,
    enabled: boolOrDefault(raw.enabled, fallback.enabled),
    channels: {
      inApp: boolOrDefault(rawChannels.inApp, fallback.channels.inApp),
      phone: boolOrDefault(rawChannels.phone, fallback.channels.phone),
    },
    params,
  };
}

export function normalizeOperationalAutomationSettings(
  value: unknown
): OperationalAutomationSettings {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const rawQuietHours =
    source.quietHours && typeof source.quietHours === "object"
      ? (source.quietHours as Record<string, unknown>)
      : {};
  const rawRules =
    source.rules && typeof source.rules === "object"
      ? (source.rules as Record<string, unknown>)
      : {};

  return {
    quietHours: {
      enabled: boolOrDefault(
        rawQuietHours.enabled,
        DEFAULT_OPERATIONAL_AUTOMATIONS.quietHours.enabled
      ),
      start: timeOrDefault(
        rawQuietHours.start,
        DEFAULT_OPERATIONAL_AUTOMATIONS.quietHours.start
      ),
      end: timeOrDefault(
        rawQuietHours.end,
        DEFAULT_OPERATIONAL_AUTOMATIONS.quietHours.end
      ),
    },
    rules: {
      planejamento_atrasado: normalizeRule(
        "planejamento_atrasado",
        rawRules.planejamento_atrasado
      ),
      manutencao_sla: normalizeRule("manutencao_sla", rawRules.manutencao_sla),
      equipe_sem_lancamento: normalizeRule(
        "equipe_sem_lancamento",
        rawRules.equipe_sem_lancamento
      ),
      sync_pendente: normalizeRule("sync_pendente", rawRules.sync_pendente),
    },
  };
}
