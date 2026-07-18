"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import {
  parseBulkText,
  type BulkColumnDefinition,
  type BulkParsedRow,
} from "@/lib/bulk-import";

type RowStatus = "pending" | "importing" | "success" | "error";
type ImportRow = BulkParsedRow & { status: RowStatus; error?: string };

export type BulkImportColumn = BulkColumnDefinition & {
  validate?: (value: string, values: Record<string, string>) => string | null;
};

export default function BulkImportDialog({
  open,
  title,
  description,
  columns,
  onClose,
  onImportRow,
  onComplete,
}: {
  open: boolean;
  title: string;
  description: string;
  columns: BulkImportColumn[];
  onClose: () => void;
  onImportRow: (values: Record<string, string>, rowIndex: number) => Promise<void>;
  onComplete?: () => void | Promise<void>;
}) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !importing) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [importing, onClose, open]);

  useEffect(() => {
    setRows(parseBulkText(text, columns).map((row) => ({ ...row, status: "pending" })));
  }, [columns, text]);

  useEffect(() => {
    if (!open) {
      setText("");
      setRows([]);
      setCopied(false);
    }
  }, [open]);

  const rowErrors = useMemo(
    () =>
      rows.map((row) => {
        for (const column of columns) {
          const value = row.values[column.key] ?? "";
          if (column.required && !value.trim()) return `${column.label} é obrigatório.`;
          const error = column.validate?.(value, row.values);
          if (error) return error;
        }
        return null;
      }),
    [columns, rows]
  );
  const localErrors = rowErrors.filter(Boolean).length;
  const successCount = rows.filter((row) => row.status === "success").length;
  const failedCount = rows.filter((row) => row.status === "error").length;

  async function copyTemplate() {
    const header = columns.map((column) => column.label).join("\t");
    const example = columns.map((column) => column.example ?? "").join("\t");
    await navigator.clipboard.writeText(`${header}\n${example}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function importRows() {
    if (rows.length === 0 || localErrors > 0) return;
    setImporting(true);
    let changed = false;
    for (let index = 0; index < rows.length; index += 1) {
      if (rows[index].status === "success") continue;
      setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, status: "importing", error: undefined } : row));
      try {
        await onImportRow(rows[index].values, index);
        changed = true;
        setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, status: "success", error: undefined } : row));
      } catch (error) {
        setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, status: "error", error: (error as Error).message } : row));
      }
    }
    setImporting(false);
    if (changed) await onComplete?.();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-import-title"
        className="flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-lg border border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl sm:rounded-lg"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-4 sm:p-5">
          <div>
            <h2 id="bulk-import-title" className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={importing}>Fechar</Button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card-alt)] p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[var(--text-secondary)]">
                Copie as colunas do Excel ou Google Sheets e cole abaixo. O cabeçalho é opcional.
              </p>
              <Button variant="secondary" size="sm" onClick={copyTemplate}>{copied ? "Modelo copiado" : "Copiar modelo"}</Button>
            </div>
            <p className="mt-2 break-words text-xs text-[var(--text-muted)]">
              Ordem: {columns.map((column) => `${column.label}${column.required ? " *" : ""}`).join(" · ")}
            </p>
          </div>

          <label className="block text-sm font-medium text-[var(--text-primary)]">
            Dados para importar
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={columns.map((column) => column.label).join("\t")}
              className="mt-2 min-h-32 w-full resize-y rounded-md border border-[var(--border)] bg-[var(--bg-input)] p-3 font-mono text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--accent-subtle)]"
              disabled={importing}
            />
          </label>

          {rows.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-[var(--border)]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--bg-card-alt)] px-3 py-2 text-xs">
                <span className="font-medium text-[var(--text-primary)]">Prévia de {rows.length} linha{rows.length === 1 ? "" : "s"}</span>
                <span className="text-[var(--text-secondary)]">
                  {successCount > 0 && `${successCount} importada${successCount === 1 ? "" : "s"} · `}
                  {failedCount > 0 && `${failedCount} com erro · `}
                  {localErrors > 0 ? `${localErrors} inválida${localErrors === 1 ? "" : "s"}` : "pronto para importar"}
                </span>
              </div>
              <div className="max-h-[42dvh] overflow-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="sticky top-0 z-10 bg-[var(--bg-card-alt)] text-left text-[var(--text-muted)]">
                    <tr>
                      <th className="w-16 px-3 py-2">Linha</th>
                      {columns.map((column) => <th key={column.key} className="px-3 py-2">{column.label}</th>)}
                      <th className="w-44 px-3 py-2">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--divider)] bg-[var(--bg-card)]">
                    {rows.map((row, index) => {
                      const localError = rowErrors[index];
                      const statusText = localError ?? (row.status === "success" ? "Importado" : row.status === "error" ? row.error : row.status === "importing" ? "Importando…" : "Pronto");
                      const statusColor = localError || row.status === "error" ? "var(--danger)" : row.status === "success" ? "var(--success)" : "var(--text-muted)";
                      return (
                        <tr key={row.id}>
                          <td className="px-3 py-2 tabular text-[var(--text-muted)]">{row.line}</td>
                          {columns.map((column) => <td key={column.key} className="max-w-52 truncate px-3 py-2 text-[var(--text-primary)]" title={row.values[column.key]}>{row.values[column.key] || "—"}</td>)}
                          <td className="px-3 py-2 text-xs font-medium" style={{ color: statusColor }}>{statusText}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--text-muted)]">Máximo de 200 linhas por importação.</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => { setText(""); setRows([]); }} disabled={importing || !text}>Limpar</Button>
            <Button onClick={importRows} loading={importing} disabled={rows.length === 0 || localErrors > 0 || successCount === rows.length}>
              {failedCount > 0 ? "Tentar erros novamente" : `Importar ${rows.length - successCount} linha${rows.length - successCount === 1 ? "" : "s"}`}
            </Button>
          </div>
        </footer>
      </section>
    </div>
  );
}
