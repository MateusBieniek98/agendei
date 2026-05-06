export type InsumoLancamento = {
  nome: string;
  quantidade: number;
};

export type InsumoCatalogItem = {
  codigo?: string;
  nome: string;
  grupo: "Herbicida" | "Operacional" | "Formicida" | "Adubo" | "Clone";
};

export const INSUMOS_CATALOGO: InsumoCatalogItem[] = [
  { codigo: "90000746", nome: "HERBICIDA SUNWARD 5KG", grupo: "Herbicida" },
  { codigo: "90000748", nome: "HERBICIDA WG 720 POS EMERGENTE ZAPP 20KG", grupo: "Herbicida" },
  { codigo: "90000749", nome: "HERBICIDA DISTINTOBR 5KG", grupo: "Herbicida" },
  { codigo: "90000750", nome: "HERBICIDA PONTEIROBR 20L", grupo: "Herbicida" },
  { codigo: "90000751", nome: "HERBICIDA PALMERO 1KG", grupo: "Herbicida" },
  { codigo: "90000754", nome: "FINALE HERBICIDA GALAO 10L", grupo: "Herbicida" },
  { codigo: "90000762", nome: "HERBICIDA SOLDIER", grupo: "Herbicida" },
  { codigo: "90000768", nome: "HERBICIDA PRE EMERGENTE BLOCK 20LT", grupo: "Herbicida" },
  { codigo: "90000769", nome: "HERBICIDA POS EMERGENTE AGILE 5L", grupo: "Herbicida" },
  { codigo: "90000775", nome: "HERBICIDA SUMYZIN 1KG", grupo: "Herbicida" },
  { codigo: "90000776", nome: "HERBICIDA TOPINAM 20L", grupo: "Herbicida" },
  { codigo: "90000779", nome: "HERBICIDA OSBAR 5KG", grupo: "Herbicida" },
  { codigo: "90000780", nome: "HERBICIDA FALCON 20L", grupo: "Herbicida" },
  { codigo: "90000789", nome: "HERBICIDA PRE EMERGENTE GOAL 20LT", grupo: "Herbicida" },
  { codigo: "90000790", nome: "HERBICIDA POS EMERGENTE SECTOR 20LT", grupo: "Herbicida" },
  { codigo: "90000791", nome: "HERBICIDA POS EMERGENTE OUTLINER 20LT", grupo: "Herbicida" },
  { codigo: "90000792", nome: "HERBICIDA PRE EMERGENTE SOLARA 20L", grupo: "Herbicida" },
  { codigo: "90000793", nome: "HERBICIDA POS EMERGENTE VALEOS 0.350KG", grupo: "Herbicida" },
  { codigo: "90000801", nome: "HERBICIDA POS EMERGENTE SCOUT 5KG", grupo: "Herbicida" },
  { codigo: "90000815", nome: "HERBICIDA PRE EMERGENTE ESPLANADE 1L", grupo: "Herbicida" },
  { codigo: "90000846", nome: "HERBICIDA FORDOR FLEX 1KG", grupo: "Herbicida" },
  { codigo: "90000852", nome: "HERBICIDA PRE EMERGENTE FLUMYZIN 500 5L", grupo: "Herbicida" },
  { codigo: "90000991", nome: "HERBICIDA TRICLOPIR PERTERRA", grupo: "Herbicida" },
  { nome: "OLEO MINERAL CONCENTRADO EMULSIONADO", grupo: "Operacional" },
  { nome: "INSETICIDA PREZ", grupo: "Operacional" },
  { nome: "FIPRONIL PIRAZOL", grupo: "Operacional" },
  { nome: "GEL", grupo: "Operacional" },
  { nome: "ATTAMEX-S", grupo: "Operacional" },
  { nome: "PLEDGE", grupo: "Operacional" },
  { nome: "MAP", grupo: "Operacional" },
  { nome: "FORMICIDA PO SULFURAMID ATTA-KILL/MIREX", grupo: "Formicida" },
  { nome: "FORMICIDA ISCA DINAGRO S 5KG", grupo: "Formicida" },
  { nome: "Adubo 16-6-20", grupo: "Adubo" },
  { nome: "CO1058", grupo: "Clone" },
  { nome: "CO1572", grupo: "Clone" },
  { nome: "AECO144", grupo: "Clone" },
  { nome: "SUZA", grupo: "Clone" },
];

function catalogKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function insumoCatalogDisplay(item: InsumoCatalogItem) {
  return item.codigo ? `${item.codigo} · ${item.nome}` : `${item.nome} · ${item.grupo}`;
}

export function normalizeInsumoInput(input: unknown) {
  const raw = String(input ?? "").trim();
  if (!raw) return "";

  const rawKey = catalogKey(raw);
  const found = INSUMOS_CATALOGO.find((item) => {
    const nomeKey = catalogKey(item.nome);
    const codigoKey = catalogKey(item.codigo ?? "");
    const displayKey = catalogKey(insumoCatalogDisplay(item));
    return rawKey === nomeKey || rawKey === codigoKey || rawKey === displayKey;
  });

  if (found) return found.nome;

  const [, afterSeparator] = raw.split("·");
  if (afterSeparator) {
    return afterSeparator.replace(/\s+·\s+(Herbicida|Operacional|Formicida|Adubo|Clone)$/i, "").trim();
  }

  return raw;
}

export function sanitizeInsumos(input: unknown): InsumoLancamento[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const nome = normalizeInsumoInput(record.nome);
      const quantidade = Number(record.quantidade ?? 0);
      if (!nome || !Number.isFinite(quantidade) || quantidade <= 0) return null;
      return { nome, quantidade };
    })
    .filter((item): item is InsumoLancamento => item !== null)
    .slice(0, 5);
}

export function optionalNumber(input: unknown): number | null {
  if (input === "" || input === null || input === undefined) return null;
  const value = Number(input);
  return Number.isFinite(value) ? value : null;
}

export function insumosToColumns(input: unknown, max = 5) {
  const rows = sanitizeInsumos(input);
  return Array.from({ length: max }, (_, index) => rows[index] ?? null);
}
