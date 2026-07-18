"use client";

import Button from "@/components/ui/Button";

export default function BulkSelectionBar({
  selectedCount,
  visibleCount,
  allVisibleSelected,
  deleting,
  onToggleAll,
  onClear,
  onDelete,
}: {
  selectedCount: number;
  visibleCount: number;
  allVisibleSelected: boolean;
  deleting?: boolean;
  onToggleAll: () => void;
  onClear: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3 sm:flex-row sm:items-center sm:justify-between">
      <label className="inline-flex min-h-9 items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
        <input type="checkbox" checked={visibleCount > 0 && allVisibleSelected} onChange={onToggleAll} className="h-4 w-4 accent-[var(--accent)]" />
        Selecionar itens visíveis
      </label>
      <div className="flex items-center gap-2">
        <span className="mr-auto text-sm text-[var(--text-secondary)] sm:mr-2">{selectedCount} selecionado{selectedCount === 1 ? "" : "s"}</span>
        {selectedCount > 0 && <Button variant="ghost" size="sm" onClick={onClear} disabled={deleting}>Limpar</Button>}
        <Button variant="danger" size="sm" onClick={onDelete} loading={deleting} disabled={selectedCount === 0}>Excluir selecionados</Button>
      </div>
    </div>
  );
}
