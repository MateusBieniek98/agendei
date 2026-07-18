export type BulkColumnDefinition = {
  key: string;
  label: string;
  example?: string;
  required?: boolean;
};

export type BulkParsedRow = {
  id: string;
  line: number;
  values: Record<string, string>;
};

export function normalizeBulkValue(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function parseDelimitedLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function detectDelimiter(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  if (firstLine.includes("\t")) return "\t";
  if (firstLine.includes(";")) return ";";
  return ",";
}

export function parseBulkText(
  text: string,
  columns: BulkColumnDefinition[],
  limit = 200
): BulkParsedRow[] {
  const normalizedText = text.replace(/\r\n/g, "\n").trim();
  if (!normalizedText) return [];

  const delimiter = detectDelimiter(normalizedText);
  const lines = normalizedText
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .slice(0, limit + 1);
  if (lines.length === 0) return [];

  const parsed = lines.map((line) => parseDelimitedLine(line, delimiter));
  const aliases = new Map<string, string>();
  for (const column of columns) {
    aliases.set(normalizeBulkValue(column.key), column.key);
    aliases.set(normalizeBulkValue(column.label), column.key);
  }

  const headerKeys = parsed[0].map((cell) => aliases.get(normalizeBulkValue(cell)) ?? null);
  const headerMatches = headerKeys.filter(Boolean).length;
  const hasHeader = headerMatches >= Math.min(2, columns.length);
  const rows = hasHeader ? parsed.slice(1) : parsed;
  const startLine = hasHeader ? 2 : 1;

  return rows.slice(0, limit).map((cells, rowIndex) => {
    const values: Record<string, string> = {};
    cells.forEach((cell, cellIndex) => {
      const key = hasHeader ? headerKeys[cellIndex] : columns[cellIndex]?.key;
      if (key) values[key] = cell.trim();
    });
    for (const column of columns) values[column.key] ??= "";
    return {
      id: `${startLine + rowIndex}-${rowIndex}`,
      line: startLine + rowIndex,
      values,
    };
  });
}

export function parseNumberPtBr(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const number = Number(normalized.replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : null;
}

export function parseBooleanPtBr(value: unknown, fallback = true) {
  const normalized = normalizeBulkValue(value);
  if (!normalized) return fallback;
  if (["sim", "s", "true", "1", "ativo", "ativa"].includes(normalized)) return true;
  if (["nao", "n", "false", "0", "inativo", "inativa"].includes(normalized)) return false;
  return fallback;
}

export function parseDatePtBr(value: unknown) {
  const raw = String(value ?? "").trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const brMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const parts = isoMatch
    ? { year: isoMatch[1], month: isoMatch[2], day: isoMatch[3] }
    : brMatch
      ? { year: brMatch[3], month: brMatch[2].padStart(2, "0"), day: brMatch[1].padStart(2, "0") }
      : null;
  if (!parts) return null;
  const iso = `${parts.year}-${parts.month}-${parts.day}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso ? null : iso;
}

export async function responseError(response: Response) {
  const json = await response.json().catch(() => ({}));
  if (response.ok) return json;
  throw new Error(json.error ?? response.statusText ?? "Falha ao salvar");
}
