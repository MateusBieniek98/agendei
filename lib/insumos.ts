import { parseNumberPtBr } from "@/lib/bulk-import";

export type InsumoLancamento = {
  insumo_id?: string;
  id?: string;
  codigo?: string | null;
  nome: string;
  unidade?: string | null;
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

export type InsumoEstoqueItem = {
  id: string;
  codigo: string | null;
  nome: string;
  grupo: string;
  unidade: string;
  saldo_atual: number;
  estoque_minimo: number;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ControlledInsumoPayload = {
  insumo_id: string;
  quantidade: number;
};

export const MAX_PRODUCTION_INSUMOS = 6;

const INSUMOS_CACHE_KEY = "gn:insumos-cache:v1";

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

  const rows: InsumoLancamento[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const nome = normalizeInsumoInput(record.nome);
    const quantidade = Number(record.quantidade ?? 0);
    if (!nome || !Number.isFinite(quantidade) || quantidade <= 0) continue;
    rows.push({
      insumo_id: typeof record.insumo_id === "string" ? record.insumo_id : undefined,
      id: typeof record.id === "string" ? record.id : undefined,
      codigo: record.codigo == null ? null : String(record.codigo),
      nome,
      unidade: record.unidade == null ? null : String(record.unidade),
      quantidade,
    });
  }

  return rows.slice(0, MAX_PRODUCTION_INSUMOS);
}

export function sanitizeControlledInsumos(input: unknown): ControlledInsumoPayload[] {
  if (!Array.isArray(input)) return [];

  const totals = new Map<string, number>();
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const rawId = record.insumo_id ?? record.id;
    const insumoId = typeof rawId === "string" ? rawId.trim() : "";
    const quantidade = Number(record.quantidade ?? 0);
    if (!insumoId || !Number.isFinite(quantidade) || quantidade <= 0) continue;
    totals.set(insumoId, (totals.get(insumoId) ?? 0) + quantidade);
  }

  return Array.from(totals, ([insumo_id, quantidade]) => ({
    insumo_id,
    quantidade,
  })).slice(0, MAX_PRODUCTION_INSUMOS);
}

export function parseBulkImportedInsumos(
  values: Record<string, string>,
  catalog: Array<Pick<InsumoEstoqueItem, "id" | "codigo" | "nome" | "unidade" | "ativo">>,
  max = MAX_PRODUCTION_INSUMOS
) {
  const totals = new Map<
    string,
    { insumo_id: string; nome: string; unidade: string; quantidade: number }
  >();

  for (let position = 1; position <= max; position += 1) {
    const reference = String(values[`insumo_${position}`] ?? "").trim();
    const quantityRaw = String(values[`quantidade_insumo_${position}`] ?? "").trim();
    if (!reference && !quantityRaw) continue;
    if (!reference) throw new Error(`Insumo ${position} não informado.`);
    if (!quantityRaw) throw new Error(`Quantidade do insumo ${position} não informada.`);

    const quantidade = parseNumberPtBr(quantityRaw);
    if (quantidade === null || quantidade <= 0) {
      throw new Error(`Quantidade inválida para o insumo ${position}: ${quantityRaw}`);
    }

    const normalizedReference = catalogKey(reference);
    const item = catalog.find(
      (candidate) =>
        candidate.ativo !== false &&
        (catalogKey(candidate.codigo ?? "") === normalizedReference ||
          catalogKey(candidate.nome) === normalizedReference)
    );
    if (!item) throw new Error(`Insumo ${position} não encontrado: ${reference}`);

    const current = totals.get(item.id);
    totals.set(item.id, {
      insumo_id: item.id,
      nome: item.nome,
      unidade: item.unidade,
      quantidade: (current?.quantidade ?? 0) + quantidade,
    });
  }

  return Array.from(totals.values());
}

export function hasOnlyControlledInsumos(input: unknown) {
  if (!Array.isArray(input)) return true;
  return input.every((item) => {
    if (!item || typeof item !== "object") return true;
    const record = item as Record<string, unknown>;
    const quantidade = Number(record.quantidade ?? 0);
    const hasQuantity = Number.isFinite(quantidade) && quantidade > 0;
    if (!hasQuantity) return true;
    return typeof record.insumo_id === "string" || typeof record.id === "string";
  });
}

function normalizeCachedInsumo(item: unknown): InsumoEstoqueItem | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const record = item as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : "";
  const nome = typeof record.nome === "string" ? record.nome : "";
  if (!id || !nome) return null;
  return {
    id,
    codigo: record.codigo == null ? null : String(record.codigo),
    nome,
    grupo: typeof record.grupo === "string" ? record.grupo : "Operacional",
    unidade: typeof record.unidade === "string" ? record.unidade : "un",
    saldo_atual: Number(record.saldo_atual ?? 0),
    estoque_minimo: Number(record.estoque_minimo ?? 0),
    ativo: record.ativo !== false,
    created_at: typeof record.created_at === "string" ? record.created_at : undefined,
    updated_at: typeof record.updated_at === "string" ? record.updated_at : undefined,
  };
}

export function readCachedInsumos(): InsumoEstoqueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(INSUMOS_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeCachedInsumo).filter((item): item is InsumoEstoqueItem => !!item);
  } catch {
    return [];
  }
}

export function writeCachedInsumos(items: InsumoEstoqueItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INSUMOS_CACHE_KEY, JSON.stringify(items));
  } catch {
    // O cache é apenas uma conveniência para operação offline.
  }
}

export function optionalNumber(input: unknown): number | null {
  if (input === "" || input === null || input === undefined) return null;
  const value = Number(input);
  return Number.isFinite(value) ? value : null;
}

export function insumosToColumns(input: unknown, max = MAX_PRODUCTION_INSUMOS) {
  const rows = sanitizeInsumos(input);
  return Array.from({ length: max }, (_, index) => rows[index] ?? null);
}
