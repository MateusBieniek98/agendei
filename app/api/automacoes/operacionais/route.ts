import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import {
  createAppSettingsClient,
  getOperationalAutomationSettings,
  normalizeOperationalAutomationSettings,
  OPERATIONAL_AUTOMATIONS_KEY,
} from "@/lib/app-settings";
import { createSupabaseServer } from "@/lib/supabase/server";
import { APP_TIME_ZONE, dataOperacionalISO } from "@/lib/period";
import { enrichPlanningProgress } from "@/lib/planning-progress";
import {
  AUTOMATION_RULE_ORDER,
  type AutomationRuleId,
  type AutomationSeverity,
  type OperationalAutomationRule,
  type OperationalAutomationSettings,
} from "@/lib/operational-automations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RuleStatus = AutomationSeverity | "ok" | "disabled";

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

type PlanningRow = {
  id: string;
  data_limite: string;
  talhao: string;
  quantidade_prevista: number | string | null;
  projeto_id: string;
  atividade_id: string;
  status: string;
  projetos?: { nome?: string | null } | null;
  atividades?: {
    nome?: string | null;
    unidade?: string | null;
    valor_unitario?: number | string | null;
  } | null;
  equipes?: { nome?: string | null } | null;
};

type MaintenanceRow = {
  id: string;
  status: string;
  created_at: string;
  descricao: string;
  talhao: string | null;
  maquinas?: {
    nome?: string | null;
    tipo?: string | null;
    identificador?: string | null;
    status?: string | null;
  } | null;
  equipes?: { nome?: string | null } | null;
  projetos?: { nome?: string | null } | null;
};

type TeamRow = {
  id: string;
  nome: string;
};

type ProductionTeamRow = {
  equipe_id: string | null;
};

type SyncJobRow = {
  id: string;
  tipo: string;
  status: string;
  attempts: number | null;
  last_error: string | null;
  created_at: string;
};

function addDaysISO(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function ddmmyyyy(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function hoursSince(iso: string, now = new Date()) {
  const value = new Date(iso).getTime();
  if (!Number.isFinite(value)) return 0;
  return Math.max((now.getTime() - value) / 36e5, 0);
}

function currentHour() {
  const value = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    hour: "numeric",
    hourCycle: "h23",
  }).format(new Date());
  return Number(value);
}

function ruleStatus(rule: OperationalAutomationRule, count: number): RuleStatus {
  if (!rule.enabled) return "disabled";
  return count > 0 ? rule.severity : "ok";
}

function asRuleEvaluation(
  rule: OperationalAutomationRule,
  href: string,
  occurrences: AutomationOccurrence[],
  totalCount = occurrences.length
): RuleEvaluation {
  return {
    rule,
    status: ruleStatus(rule, totalCount),
    count: rule.enabled ? totalCount : 0,
    href,
    occurrences: rule.enabled ? occurrences.slice(0, 8) : [],
  };
}

function phonePushReady() {
  return Boolean(
    process.env.WEB_PUSH_PUBLIC_KEY &&
      process.env.WEB_PUSH_PRIVATE_KEY &&
      process.env.WEB_PUSH_SUBJECT
  );
}

async function evaluatePlanejamento(
  settings: OperationalAutomationSettings
): Promise<RuleEvaluation> {
  const rule = settings.rules.planejamento_atrasado;
  const href = "/admin/planejamento";
  if (!rule.enabled) return asRuleEvaluation(rule, href, []);

  const supabase = await createSupabaseServer();
  const today = dataOperacionalISO();
  const tolerance = Number(rule.params.daysTolerance ?? 0);

  const { data, error } = await supabase
    .from("planejamento")
    .select("*, projetos(nome), atividades(nome, unidade, valor_unitario), equipes(nome)")
    .not("status", "in", "(concluido,cancelado)")
    .order("data_limite", { ascending: true })
    .limit(500);

  if (error) throw new Error(error.message);

  const enriched = await enrichPlanningProgress(
    supabase,
    (data ?? []) as unknown as PlanningRow[]
  );
  const atrasados = enriched.filter((item) => {
    const pct = Number(item.pct_realizado ?? 0);
    return pct < 100 && addDaysISO(item.data_limite, tolerance) < today;
  });

  return asRuleEvaluation(
    rule,
    href,
    atrasados.map((item) => {
      const prevista = Number(item.quantidade_prevista ?? 0);
      const realizada = Number(item.quantidade_realizada ?? 0);
      const unidade = item.atividades?.unidade ?? "ha";
      return {
        id: item.id,
        title: item.atividades?.nome ?? "Atividade planejada",
        subtitle: `${item.projetos?.nome ?? "Projeto"} · Talhão ${item.talhao}`,
        meta: `${realizada.toFixed(1)}/${prevista.toFixed(1)} ${unidade} · ${ddmmyyyy(item.data_limite)}`,
        href,
      };
    }),
    atrasados.length
  );
}

async function evaluateManutencao(
  settings: OperationalAutomationSettings
): Promise<RuleEvaluation> {
  const rule = settings.rules.manutencao_sla;
  const href = "/admin/maquinas";
  if (!rule.enabled) return asRuleEvaluation(rule, href, []);

  const supabase = await createSupabaseServer();
  const now = new Date();
  const slaHours = Number(rule.params.slaHours ?? 24);
  const { data, error } = await supabase
    .from("manutencoes")
    .select(
      "id, status, created_at, descricao, talhao, maquinas(nome, tipo, identificador, status), equipes(nome), projetos(nome)"
    )
    .neq("status", "resolvido")
    .order("created_at", { ascending: true })
    .limit(300);

  if (error) throw new Error(error.message);

  const abertas = ((data ?? []) as unknown as MaintenanceRow[]).filter((item) => {
    return (
      hoursSince(item.created_at, now) >= slaHours ||
      item.maquinas?.status === "manutencao_urgente"
    );
  });

  return asRuleEvaluation(
    rule,
    href,
    abertas.map((item) => {
      const age = Math.floor(hoursSince(item.created_at, now));
      const maquina = item.maquinas?.nome ?? "Máquina";
      const identificador = item.maquinas?.identificador
        ? ` · ${item.maquinas.identificador}`
        : "";
      return {
        id: item.id,
        title: `${maquina}${identificador}`,
        subtitle: `${item.projetos?.nome ?? "Projeto"} · ${item.equipes?.nome ?? "Equipe"}`,
        meta: `${age}h aberta · ${item.status.replace("_", " ")}`,
        href,
      };
    }),
    abertas.length
  );
}

async function evaluateLancamentos(
  settings: OperationalAutomationSettings
): Promise<RuleEvaluation> {
  const rule = settings.rules.equipe_sem_lancamento;
  const href = "/admin/lancamentos";
  if (!rule.enabled) return asRuleEvaluation(rule, href, []);

  const notifyAfterHour = Number(rule.params.notifyAfterHour ?? 16);
  if (currentHour() < notifyAfterHour) {
    return asRuleEvaluation(rule, href, [], 0);
  }

  const supabase = await createSupabaseServer();
  const today = dataOperacionalISO();
  const [{ data: equipes, error: equipesError }, { data: producao, error: producaoError }] =
    await Promise.all([
      supabase.from("equipes").select("id, nome").eq("ativo", true).order("nome"),
      supabase.from("producao").select("equipe_id").eq("data", today).limit(1000),
    ]);

  if (equipesError) throw new Error(equipesError.message);
  if (producaoError) throw new Error(producaoError.message);

  const comLancamento = new Set(
    ((producao ?? []) as ProductionTeamRow[])
      .map((item) => item.equipe_id)
      .filter(Boolean)
  );
  const pendentes = ((equipes ?? []) as TeamRow[]).filter(
    (equipe) => !comLancamento.has(equipe.id)
  );

  return asRuleEvaluation(
    rule,
    href,
    pendentes.map((equipe) => ({
      id: equipe.id,
      title: equipe.nome,
      subtitle: "Sem apontamento no dia operacional",
      meta: ddmmyyyy(today),
      href,
    })),
    pendentes.length
  );
}

async function evaluateSync(
  settings: OperationalAutomationSettings
): Promise<RuleEvaluation> {
  const rule = settings.rules.sync_pendente;
  const href = "/admin/entrada";
  if (!rule.enabled) return asRuleEvaluation(rule, href, []);

  const supabase = await createSupabaseServer();
  const minAttempts = Number(rule.params.minAttempts ?? 1);
  const { data, error } = await supabase
    .from("sync_jobs")
    .select("id, tipo, status, attempts, last_error, created_at")
    .in("status", ["pendente", "erro"])
    .gte("attempts", minAttempts)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);

  const jobs = (data ?? []) as SyncJobRow[];
  return asRuleEvaluation(
    rule,
    href,
    jobs.map((job) => ({
      id: job.id,
      title: `${job.tipo} · ${job.status}`,
      subtitle: job.last_error ?? "Aguardando processamento",
      meta: `${job.attempts ?? 0} tentativas`,
      href,
    })),
    jobs.length
  );
}

async function evaluateRules(settings: OperationalAutomationSettings) {
  const evaluations = await Promise.all([
    evaluatePlanejamento(settings),
    evaluateManutencao(settings),
    evaluateLancamentos(settings),
    evaluateSync(settings),
  ]);
  const byId = new Map(evaluations.map((item) => [item.rule.id, item]));
  return AUTOMATION_RULE_ORDER.map((id: AutomationRuleId) => byId.get(id)).filter(
    Boolean
  ) as RuleEvaluation[];
}

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (profile.role !== "admin") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const settings = await getOperationalAutomationSettings();
  const rules = await evaluateRules(settings);
  const summary = rules.reduce(
    (acc, item) => {
      if (item.status === "critical") acc.critical += item.count;
      if (item.status === "warning") acc.warning += item.count;
      if (item.status === "info") acc.info += item.count;
      if (item.status === "ok") acc.ok += 1;
      if (item.status === "disabled") acc.disabled += 1;
      return acc;
    },
    { critical: 0, warning: 0, info: 0, ok: 0, disabled: 0 }
  );

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    today: dataOperacionalISO(),
    phonePushReady: phonePushReady(),
    settings,
    summary,
    rules,
  });
}

export async function PATCH(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const settings = normalizeOperationalAutomationSettings(body?.settings ?? body);
  const client = createAppSettingsClient();

  if (!client || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY nao configurada no servidor para salvar automacoes.",
      },
      { status: 500 }
    );
  }

  const { error } = await client.from("app_settings").upsert(
    {
      key: OPERATIONAL_AUTOMATIONS_KEY,
      value: settings,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rules = await evaluateRules(settings);
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    today: dataOperacionalISO(),
    phonePushReady: phonePushReady(),
    settings,
    rules,
  });
}
