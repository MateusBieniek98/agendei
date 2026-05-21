// Helpers de período de produção GN.
//
// O ciclo de produção da empresa vai do dia 21 de um mês ao dia 20 do
// mês seguinte. O cálculo precisa seguir o calendário da operação
// (Campo Grande), inclusive quando roda na Vercel em UTC.

export const APP_TIME_ZONE = "America/Campo_Grande";

const DAY_MS = 1000 * 60 * 60 * 24;

type LocalDateParts = {
  year: number;
  monthIndex: number;
  day: number;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function getLocalDateParts(
  date: Date = new Date(),
  timeZone = APP_TIME_ZONE
): LocalDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    monthIndex: Number(values.month) - 1,
    day: Number(values.day),
  };
}

function utcDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));
}

function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return utcDate(year, month - 1, day);
}

function toISO(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(
    d.getUTCDate()
  )}`;
}

function ddmm(d: Date): string {
  return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}`;
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function diffDaysInclusive(de: Date, ate: Date): number {
  return Math.round((ate.getTime() - de.getTime()) / DAY_MS) + 1;
}

export function dataOperacionalISO(today: Date = new Date()): string {
  const { year, monthIndex, day } = getLocalDateParts(today);
  return toISO(utcDate(year, monthIndex, day));
}

export type Periodo = {
  de: string; // yyyy-mm-dd
  ate: string; // yyyy-mm-dd
  label: string; // "21/01 a 20/02"
  diasTotais: number;
};

function build(de: Date, ate: Date, label?: string): Periodo {
  const diasTotais = diffDaysInclusive(de, ate);
  return {
    de: toISO(de),
    ate: toISO(ate),
    label: label ?? `${ddmm(de)} a ${ddmm(ate)}`,
    diasTotais,
  };
}

/** Ciclo 21→20 que CONTÉM o dia `today`. */
export function cicloProducao(today: Date = new Date()): Periodo {
  const { year: y, monthIndex: m, day } = getLocalDateParts(today);

  let de: Date;
  let ate: Date;

  if (day >= 21) {
    de = utcDate(y, m, 21);
    ate = utcDate(m === 11 ? y + 1 : y, m === 11 ? 0 : m + 1, 20);
  } else {
    de = utcDate(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1, 21);
    ate = utcDate(y, m, 20);
  }
  return build(de, ate);
}

/** Ciclo imediatamente anterior. */
export function cicloAnterior(today: Date = new Date()): Periodo {
  const atual = cicloProducao(today);
  const atualDe = parseISODate(atual.de);
  // Subtrai 1 dia → cai no fim do ciclo anterior, daí calcula
  return cicloProducao(addDays(atualDe, -1));
}

/** Mês corrente (1 ao último dia). */
export function mesCorrente(today: Date = new Date()): Periodo {
  const { year: y, monthIndex: m } = getLocalDateParts(today);
  const de = utcDate(y, m, 1);
  const ate = utcDate(y, m + 1, 0);
  return build(de, ate);
}

/** Mês anterior. */
export function mesAnterior(today: Date = new Date()): Periodo {
  const { year: y, monthIndex: m } = getLocalDateParts(today);
  const de = utcDate(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1, 1);
  const ate = utcDate(y, m, 0);
  return build(de, ate);
}

/** Últimos N dias (incluindo hoje). */
export function ultimosNDias(n: number, today: Date = new Date()): Periodo {
  const { year, monthIndex, day } = getLocalDateParts(today);
  const ate = utcDate(year, monthIndex, day);
  const de = addDays(ate, -(n - 1));
  return build(de, ate, `Últimos ${n} dias`);
}

/** Custom (datas que vêm do front). */
export function periodoCustom(deISO: string, ateISO: string): Periodo {
  return build(parseISODate(deISO), parseISODate(ateISO));
}

/** Quantos dias do período já passaram (incluindo hoje). Usado pra média. */
export function diasDecorridos(p: Periodo, today: Date = new Date()): number {
  const todayISO = dataOperacionalISO(today);
  const start = parseISODate(p.de);
  const end = parseISODate(todayISO < p.ate ? todayISO : p.ate);
  if (end < start) return 0;
  return diffDaysInclusive(start, end);
}

/** Dias restantes até o fim do período (≥ 1, conta hoje). */
export function diasRestantes(p: Periodo, today: Date = new Date()): number {
  const todayISO = dataOperacionalISO(today);
  if (todayISO > p.ate) return 0;
  const start = parseISODate(todayISO < p.de ? p.de : todayISO);
  const end = parseISODate(p.ate);
  return diffDaysInclusive(start, end);
}

export const PRESETS = {
  ciclo_atual: "Ciclo atual (21 → 20)",
  ciclo_anterior: "Ciclo anterior",
  mes_atual: "Mês corrente",
  mes_anterior: "Mês anterior",
  ultimos_30: "Últimos 30 dias",
  ultimos_7: "Últimos 7 dias",
  custom: "Personalizado",
} as const;

export type PeriodoPreset = keyof typeof PRESETS;

export function resolvePreset(
  preset: PeriodoPreset,
  custom?: { de: string; ate: string }
): Periodo {
  switch (preset) {
    case "ciclo_atual":
      return cicloProducao();
    case "ciclo_anterior":
      return cicloAnterior();
    case "mes_atual":
      return mesCorrente();
    case "mes_anterior":
      return mesAnterior();
    case "ultimos_30":
      return ultimosNDias(30);
    case "ultimos_7":
      return ultimosNDias(7);
    case "custom":
      if (!custom?.de || !custom?.ate) return cicloProducao();
      return periodoCustom(custom.de, custom.ate);
  }
}
