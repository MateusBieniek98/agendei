// Helpers de formatação compartilhados (BRL, datas, números).

export const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});

export const NUM = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

export function brl(v: number | null | undefined) {
  return BRL.format(Number(v ?? 0));
}

export function num(v: number | null | undefined, casas = 2) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: casas }).format(
    Number(v ?? 0)
  );
}

/** Converte 'yyyy-mm-dd' para 'dd/mm/yyyy'. */
export function ddmmyyyy(d: string | Date | null | undefined) {
  if (!d) return "";
  const date =
    typeof d === "string"
      ? /^\d{4}-\d{2}-\d{2}$/.test(d)
        ? new Date(`${d}T12:00:00`)
        : new Date(d)
      : d;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

/** ISO yyyy-mm-dd no fuso local (sem TZ shift). */
export function todayISO(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60_000).toISOString().slice(0, 10);
}

/** Dias úteis remanescentes no mês (incluindo o dia atual). */
export function diasRestantesNoMes(today = new Date()): number {
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return last - today.getDate() + 1;
}
