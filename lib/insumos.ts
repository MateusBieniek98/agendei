export type InsumoLancamento = {
  nome: string;
  quantidade: number;
};

export function sanitizeInsumos(input: unknown): InsumoLancamento[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const nome = String(record.nome ?? "").trim();
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
