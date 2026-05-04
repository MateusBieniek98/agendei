// Stub mínimo de tipos para `exceljs` 4.4.0 — o pacote referencia um
// `index.d.ts` que não está mais publicado. Se quiser tipos completos,
// instale `@types/exceljs` ou faça upgrade quando o upstream publicar.

declare module "exceljs" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Any = any;

  export interface Column {
    header?: string;
    key?: string;
    width?: number;
    numFmt?: string;
  }

  export interface Cell {
    value: Any;
    numFmt?: string;
  }

  export interface Row {
    font: Any;
    fill: Any;
    addRow(values: Any): Row;
    getCell(col: number | string): Cell;
  }

  export interface Worksheet {
    columns: Column[];
    addRow(values: Any): Row;
    getRow(n: number): Row;
    getColumn(key: string | number): Any;
  }

  export interface XlsxWriter {
    writeBuffer(): Promise<ArrayBuffer | Uint8Array>;
  }

  export class Workbook {
    creator: string;
    addWorksheet(name: string): Worksheet;
    xlsx: XlsxWriter;
  }

  const _default: { Workbook: typeof Workbook };
  export default _default;
}
