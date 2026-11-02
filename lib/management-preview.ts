import { diasUteisPeriodo, periodoCustom } from "@/lib/period";

// Dados gerados exclusivamente para a avaliação visual. Não derivam da operação.
const ACTIVITIES = [
  { name: "Capina química", unit: "ha", rate: 185 },
  { name: "Irrigação", unit: "ha", rate: 92 },
  { name: "Plantio", unit: "ha", rate: 420 },
  { name: "Preparo do solo", unit: "ha", rate: 310 },
  { name: "Controle de formiga", unit: "ha", rate: 68 },
  { name: "Horas homem", unit: "h", rate: 32 },
] as const;

type PreviewStatus = "Apontado" | "Pendente" | "Parcial";

export type PreviewRecord = {
  id: string;
  competence: string;
  date: string;
  performedOn: string;
  farm: string;
  plot: string;
  person: string;
  activity: string;
  unit: string;
  quantity: number;
  value: number;
  pointed: number;
  status: PreviewStatus;
  retroactive: boolean;
};

export type PreviewFilters = {
  competence: string;
  from: string;
  to: string;
  farm: string;
  activity: string;
  person: string;
  status: string;
};

export const PREVIEW_COMPETENCES = [
  { value: "2026-10", label: "Outubro de 2026" },
  { value: "2026-09", label: "Setembro de 2026" },
];

export function defaultPreviewFilters(competence = "2026-10"): PreviewFilters {
  return { competence, from: `${competence}-01`, to: `${competence}-28`, farm: "", activity: "", person: "", status: "" };
}

export const PREVIEW_RECORDS: PreviewRecord[] = PREVIEW_COMPETENCES.flatMap(({ value: competence }, monthIndex) => {
  const records: PreviewRecord[] = [];
  for (let day = 1; day <= 28; day++) {
    const date = `${competence}-${String(day).padStart(2, "0")}`;
    if (new Date(`${date}T12:00:00Z`).getUTCDay() === 0) continue;
    ACTIVITIES.forEach((activity, index) => {
      const quantity = (12 + ((day * 7 + index * 3 + monthIndex * 5) % 30)) / 2;
      const value = Math.round(quantity * activity.rate * 100) / 100;
      const status: PreviewStatus = (day + index) % 7 === 0 ? "Pendente" : (day + index) % 11 === 0 ? "Parcial" : "Apontado";
      const retroactive = day === 3 && index < 2;
      records.push({
        id: `demo-${competence}-${day}-${index}`,
        competence,
        date,
        performedOn: retroactive ? `${monthIndex === 0 ? "2026-09" : "2026-08"}-28` : date,
        farm: `Fazenda Modelo ${["A", "B", "C"][(day + index) % 3]}`,
        plot: `T-${String(index + 1).padStart(2, "0")}`,
        person: `Equipe ${["Alfa", "Beta", "Gama"][index % 3]}`,
        activity: activity.name,
        unit: activity.unit,
        quantity,
        value,
        pointed: status === "Apontado" ? value : status === "Parcial" ? Math.round(value * 50) / 100 : 0,
        status,
        retroactive,
      });
    });
  }
  return records;
});

export function filterPreviewRecords(records: PreviewRecord[], filters: PreviewFilters) {
  return records.filter((row) =>
    row.competence === filters.competence &&
    row.date >= filters.from && row.date <= filters.to &&
    (!filters.farm || row.farm === filters.farm) &&
    (!filters.activity || row.activity === filters.activity) &&
    (!filters.person || row.person === filters.person) &&
    (!filters.status || (filters.status === "Pendente" ? row.pointed < row.value : row.status === filters.status)),
  );
}

const money = (value: number) => Math.round(value * 100) / 100;

export function summarizePreview(records: PreviewRecord[], filters: PreviewFilters, target: number) {
  const rows = filterPreviewRecords(records, filters);
  const currentRows = rows.filter((row) => !row.retroactive);
  const total = money(rows.reduce((sum, row) => sum + row.value, 0));
  const produced = money(currentRows.reduce((sum, row) => sum + row.value, 0));
  const pointed = money(rows.reduce((sum, row) => sum + row.pointed, 0));
  const monthEnd = `${filters.competence}-${new Date(Number(filters.competence.slice(0, 4)), Number(filters.competence.slice(5)), 0).getDate()}`;
  const cut = `${filters.competence}-28`;
  const effectiveEnd = filters.to < cut ? filters.to : cut;
  const elapsedDays = filters.from <= effectiveEnd
    ? diasUteisPeriodo(periodoCustom(filters.from, effectiveEnd)) : 0;
  const monthDays = diasUteisPeriodo(periodoCustom(`${filters.competence}-01`, monthEnd));
  const pace = elapsedDays > 0 ? produced / elapsedDays : 0;
  const remainingDays = effectiveEnd < monthEnd && effectiveEnd >= `${filters.competence}-01`
    ? Math.max(0, monthDays - diasUteisPeriodo(periodoCustom(`${filters.competence}-01`, effectiveEnd))) : 0;
  const activities = ACTIVITIES.map(({ name, unit }) => {
    const group = rows.filter((row) => row.activity === name);
    return {
      name, unit, count: group.length,
      quantity: group.reduce((sum, row) => sum + row.quantity, 0),
      value: money(group.reduce((sum, row) => sum + row.value, 0)),
      pending: money(group.reduce((sum, row) => sum + row.value - row.pointed, 0)),
    };
  }).filter((group) => !filters.activity || group.name === filters.activity);

  const ranking = (key: "farm" | "person") => {
    const groups = new Map<string, number>();
    for (const row of rows) groups.set(row[key], (groups.get(row[key]) ?? 0) + row.value);
    return [...groups].map(([name, value]) => ({ name, value: money(value) })).sort((a, b) => b.value - a.value);
  };

  let cumulative = 0;
  const series = Array.from({ length: Number(monthEnd.slice(-2)) }, (_, index) => {
    const day = index + 1;
    const date = `${filters.competence}-${String(day).padStart(2, "0")}`;
    const daily = currentRows.filter((row) => row.date === date);
    const value = money(daily.reduce((sum, row) => sum + row.value, 0));
    cumulative = money(cumulative + value);
    return {
      date, day,
      value: date >= filters.from && date <= effectiveEnd ? value : null,
      cumulative: date >= filters.from && date <= effectiveEnd ? cumulative : null,
      area: date >= filters.from && date <= effectiveEnd ? daily.filter((row) => row.unit === "ha").reduce((sum, row) => sum + row.quantity, 0) : null,
      target: target * day / Number(monthEnd.slice(-2)),
    };
  });

  return {
    rows, total, produced, pointed,
    pending: money(total - pointed), retroactive: money(total - produced),
    target, pace, projection: money(pace * monthDays), elapsedDays, monthDays,
    neededPerDay: remainingDays > 0 ? Math.max(0, target - produced) / remainingDays : 0,
    progress: target > 0 ? produced / target * 100 : 0,
    area: currentRows.filter((row) => row.unit === "ha").reduce((sum, row) => sum + row.quantity, 0),
    activities, farms: ranking("farm"), people: ranking("person"), series,
  };
}

export type PreviewSummary = ReturnType<typeof summarizePreview>;
