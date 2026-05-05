// Helpers de período de produção GN.
//
// O ciclo de produção da empresa vai do dia 21 de um mês ao dia 20 do
// mês seguinte. Se hoje for ≥ 21, o ciclo atual vai de hoje-do-mês 21
// até próximo-mês 20. Caso contrário, do mês anterior 21 até este 20.

function toISO(d: Date): string {
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60_000).toISOString().slice(0, 10);
}

function ddmm(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

export type Periodo = {
  de: string; // yyyy-mm-dd
  ate: string; // yyyy-mm-dd
  label: string; // "21/01 a 20/02"
  diasTotais: number;
};

function build(de: Date, ate: Date, label?: string): Periodo {
  const diasTotais = Math.round(
    (ate.getTime() - de.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;
  return {
    de: toISO(de),
    ate: toISO(ate),
    label: label ?? `${ddmm(de)} a ${ddmm(ate)}`,
    diasTotais,
  };
}

/** Ciclo 21→20 que CONTÉM o dia `today`. */
export function cicloProducao(today: Date = new Date()): Periodo {
  const day = today.getDate();
  const y = today.getFullYear();
  const m = today.getMonth();

  let de: Date;
  let ate: Date;

  if (day >= 21) {
    de = new Date(y, m, 21);
    ate = new Date(m === 11 ? y + 1 : y, m === 11 ? 0 : m + 1, 20);
  } else {
    de = new Date(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1, 21);
    ate = new Date(y, m, 20);
  }
  return build(de, ate);
}

/** Ciclo imediatamente anterior. */
export function cicloAnterior(today: Date = new Date()): Periodo {
  const atual = cicloProducao(today);
  const atualDe = new Date(atual.de + "T12:00:00");
  // Subtrai 1 dia → cai no fim do ciclo anterior, daí calcula
  atualDe.setDate(atualDe.getDate() - 1);
  return cicloProducao(atualDe);
}

/** Mês corrente (1 ao último dia). */
export function mesCorrente(today: Date = new Date()): Periodo {
  const y = today.getFullYear();
  const m = today.getMonth();
  const de = new Date(y, m, 1);
  const ate = new Date(y, m + 1, 0);
  return build(de, ate);
}

/** Mês anterior. */
export function mesAnterior(today: Date = new Date()): Periodo {
  const y = today.getFullYear();
  const m = today.getMonth();
  const de = new Date(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1, 1);
  const ate = new Date(y, m, 0);
  return build(de, ate);
}

/** Últimos N dias (incluindo hoje). */
export function ultimosNDias(n: number, today: Date = new Date()): Periodo {
  const ate = new Date(today);
  const de = new Date(today);
  de.setDate(de.getDate() - (n - 1));
  return build(de, ate, `Últimos ${n} dias`);
}

/** Custom (datas que vêm do front). */
export function periodoCustom(deISO: string, ateISO: string): Periodo {
  return build(new Date(deISO + "T12:00:00"), new Date(ateISO + "T12:00:00"));
}

/** Quantos dias do período já passaram (incluindo hoje). Usado pra média. */
export function diasDecorridos(p: Periodo, today: Date = new Date()): number {
  const todayISO = toISO(today);
  const start = new Date(p.de + "T12:00:00");
  const end = new Date(
    (todayISO < p.ate ? todayISO : p.ate) + "T12:00:00"
  );
  if (end < start) return 0;
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

/** Dias restantes até o fim do período (≥ 1, conta hoje). */
export function diasRestantes(p: Periodo, today: Date = new Date()): number {
  const todayISO = toISO(today);
  if (todayISO > p.ate) return 0;
  const start = new Date((todayISO < p.de ? p.de : todayISO) + "T12:00:00");
  const end = new Date(p.ate + "T12:00:00");
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
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
