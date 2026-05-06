"use client";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export const DEFAULT_LIST_LIMIT = 20;

export function normalizeListText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function searchItems<T>(
  items: T[],
  query: string,
  fields: Array<(item: T) => unknown>
) {
  const q = normalizeListText(query);
  if (!q) return items;
  return items.filter((item) =>
    fields.some((field) => normalizeListText(field(item)).includes(q))
  );
}

export function visibleItems<T>(items: T[], expanded: boolean, limit = DEFAULT_LIST_LIMIT) {
  return expanded ? items : items.slice(0, limit);
}

export default function ListControls({
  search,
  onSearchChange,
  expanded,
  onExpandedChange,
  total,
  visible,
  label = "Pesquisar",
  placeholder = "Buscar por nome, projeto, talhão...",
  limit = DEFAULT_LIST_LIMIT,
  children,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  expanded: boolean;
  onExpandedChange: (value: boolean) => void;
  total: number;
  visible: number;
  label?: string;
  placeholder?: string;
  limit?: number;
  children?: React.ReactNode;
}) {
  const canToggle = total > limit;

  return (
    <div className="rounded-2xl border border-[var(--color-ink-200)] bg-white p-3 shadow-sm">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(18rem,1fr)_auto] lg:items-end">
        <Input
          label={label}
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          placeholder={placeholder}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
          <p className="text-sm font-bold text-[var(--color-ink-600)]">
            Mostrando {visible} de {total}
          </p>
          {canToggle && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => onExpandedChange(!expanded)}
              className="w-full sm:w-auto"
            >
              {expanded ? "Recolher lista" : "Mostrar tudo"}
            </Button>
          )}
        </div>
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
