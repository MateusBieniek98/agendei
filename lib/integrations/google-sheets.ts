// Adapter para Google Sheets via IMPORTDATA / Apps Script.
// Use este arquivo como referência ao construir endpoints públicos
// que serão consumidos pelo Sheets.

export type SheetsRow = {
  data: string;
  equipe: string;
  atividade: string;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  total: number;
  observacoes: string;
};

/** Normaliza um lançamento de produção para uma linha pronta para Sheets. */
export function toSheetsRow(input: {
  data: string;
  quantidade: number;
  valor_unitario_snapshot: number;
  observacoes: string | null;
  equipes: { nome: string } | null;
  atividades: { nome: string; unidade: string } | null;
}): SheetsRow {
  const total = Number(input.quantidade) * Number(input.valor_unitario_snapshot);
  return {
    data: input.data,
    equipe: input.equipes?.nome ?? "",
    atividade: input.atividades?.nome ?? "",
    quantidade: Number(input.quantidade),
    unidade: input.atividades?.unidade ?? "",
    valor_unitario: Number(input.valor_unitario_snapshot),
    total,
    observacoes: input.observacoes ?? "",
  };
}

/**
 * Exemplo de uso no Apps Script (cole no editor de Apps Script do Sheets):
 *
 *   function importarGN() {
 *     const url = 'https://SEU_DOMINIO/api/export/csv?escopo=mes';
 *     const r = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer TOKEN' } });
 *     const sheet = SpreadsheetApp.getActiveSheet();
 *     sheet.clear();
 *     const rows = Utilities.parseCsv(r.getContentText());
 *     sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
 *   }
 */
