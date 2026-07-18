"use client";

import { useEffect, useMemo, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import ListControls, { searchItems, visibleItems } from "@/components/ui/ListControls";
import PageHeader from "@/components/ui/PageHeader";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { num } from "@/lib/format";
import type { Insumo } from "@/lib/types";
import BulkImportDialog, { type BulkImportColumn } from "@/components/bulk/BulkImportDialog";
import BulkSelectionBar from "@/components/bulk/BulkSelectionBar";
import { parseBooleanPtBr, parseNumberPtBr, responseError } from "@/lib/bulk-import";

const SUPPLY_COLUMNS: BulkImportColumn[] = [
  { key: "codigo", label: "Código", example: "INS-001" },
  { key: "nome", label: "Nome", example: "Óleo mineral", required: true },
  { key: "grupo", label: "Grupo", example: "Operacional", required: true },
  { key: "unidade", label: "Unidade", example: "L", required: true },
  { key: "estoque_minimo", label: "Estoque mínimo", example: "10", validate: (value) => value && (parseNumberPtBr(value) ?? -1) < 0 ? "Estoque mínimo inválido." : null },
  { key: "ativo", label: "Ativo", example: "sim" },
];

type EditingInsumo = Partial<Insumo>;
type MovementState = {
  insumo: Insumo;
  tipo: "entrada" | "ajuste";
  quantidade: string;
  observacoes: string;
};

function statusTone(item: Insumo): "neutral" | "success" | "warning" | "danger" {
  if (!item.ativo) return "neutral";
  if (Number(item.saldo_atual) <= 0) return "danger";
  if (Number(item.saldo_atual) <= Number(item.estoque_minimo)) return "warning";
  return "success";
}

function statusLabel(item: Insumo) {
  if (!item.ativo) return "inativo";
  if (Number(item.saldo_atual) <= 0) return "zerado";
  if (Number(item.saldo_atual) <= Number(item.estoque_minimo)) return "baixo";
  return "disponível";
}

export default function AdminInsumosPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("");
  const [expandida, setExpandida] = useState(false);
  const [editing, setEditing] = useState<EditingInsumo | null>(null);
  const [movement, setMovement] = useState<MovementState | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const r = await fetch("/api/insumos?include_inactive=1");
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error ?? r.statusText);
      setItems(Array.isArray(j.items) ? (j.items as Insumo[]) : []);
    } catch (err) {
      setItems([]);
      toast(`Erro ao carregar insumos: ${(err as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvar() {
    if (!editing?.nome || !editing.unidade || !editing.grupo) {
      toast("Preencha nome, grupo e unidade.", "error");
      return;
    }

    const url = editing.id ? `/api/insumos/${editing.id}` : "/api/insumos";
    const method = editing.id ? "PATCH" : "POST";
    const r = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        codigo: editing.codigo || null,
        nome: editing.nome,
        grupo: editing.grupo,
        unidade: editing.unidade,
        estoque_minimo: Number(editing.estoque_minimo ?? 0),
        ativo: editing.ativo ?? true,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      toast(`Erro: ${j.error ?? r.statusText}`, "error");
      return;
    }
    toast("Insumo salvo.", "success");
    setEditing(null);
    carregar();
  }

  async function inativar(item: Insumo) {
    if (!confirm(`Inativar ${item.nome}?`)) return;
    const r = await fetch(`/api/insumos/${item.id}`, { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      toast(`Erro: ${j.error ?? r.statusText}`, "error");
      return;
    }
    toast("Insumo inativado.", "success");
    carregar();
  }

  async function salvarMovimento() {
    if (!movement) return;
    const quantidade = Number(movement.quantidade);
    if (!Number.isFinite(quantidade) || quantidade === 0) {
      toast("Informe uma quantidade válida.", "error");
      return;
    }
    if (movement.tipo === "entrada" && quantidade <= 0) {
      toast("Entrada deve ser positiva.", "error");
      return;
    }

    const r = await fetch(`/api/insumos/${movement.insumo.id}/movimentacoes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tipo: movement.tipo,
        quantidade,
        observacoes: movement.observacoes || null,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      toast(`Erro: ${j.error ?? r.statusText}`, "error");
      return;
    }
    toast("Estoque atualizado.", "success");
    setMovement(null);
    carregar();
  }

  async function importar(values: Record<string, string>) {
    await responseError(await fetch("/api/insumos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        codigo: values.codigo.trim() || null,
        nome: values.nome.trim(),
        grupo: values.grupo.trim(),
        unidade: values.unidade.trim(),
        estoque_minimo: parseNumberPtBr(values.estoque_minimo) ?? 0,
        ativo: parseBooleanPtBr(values.ativo),
      }),
    }));
  }

  async function excluirSelecionados() {
    if (!selected.size || !confirm(`Inativar ${selected.size} insumo${selected.size === 1 ? "" : "s"}? O histórico e os saldos serão preservados.`)) return;
    setDeleting(true);
    let errors = 0;
    for (const id of selected) if (!(await fetch(`/api/insumos/${id}`, { method: "DELETE" })).ok) errors += 1;
    setDeleting(false);
    setSelected(new Set());
    toast(errors ? `${errors} insumo(s) não puderam ser inativados.` : "Insumos inativados.", errors ? "error" : "success");
    await carregar();
  }

  const filtradas = useMemo(() => {
    const byStatus = items.filter((item) => {
      if (statusFiltro === "ativos") return item.ativo;
      if (statusFiltro === "inativos") return !item.ativo;
      if (statusFiltro === "baixo") {
        return item.ativo && Number(item.saldo_atual) > 0 && Number(item.saldo_atual) <= Number(item.estoque_minimo);
      }
      if (statusFiltro === "zerado") return item.ativo && Number(item.saldo_atual) <= 0;
      return true;
    });
    return searchItems(byStatus, busca, [
      (item) => item.codigo,
      (item) => item.nome,
      (item) => item.grupo,
      (item) => item.unidade,
    ]);
  }, [items, busca, statusFiltro]);

  const visiveis = visibleItems(filtradas, expandida, 25);
  const estoqueAindaNaoInicializado =
    !loading &&
    items.some((item) => item.ativo) &&
    items.filter((item) => item.ativo).every((item) => Number(item.saldo_atual) === 0);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Estoque"
        title="Insumos"
        subtitle="Cadastro e saldo disponível para os próximos apontamentos."
        right={
          <div className="flex w-full gap-2 sm:w-auto">
            <Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => setBulkOpen(true)}>Importar em lote</Button>
            <Button className="flex-1 sm:flex-none" onClick={() => setEditing({ codigo: "", nome: "", grupo: "Operacional", unidade: "un", estoque_minimo: 0, ativo: true })}>+ Novo insumo</Button>
          </div>
        }
      />

      {estoqueAindaNaoInicializado && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-bold">Estoque inicial ainda não informado</p>
          <p className="mt-1">
            Todos os insumos ativos estão zerados. Registre uma entrada ou ajuste com o saldo físico real antes de usar o controle nos próximos apontamentos.
          </p>
        </div>
      )}

      <BulkSelectionBar selectedCount={selected.size} visibleCount={visiveis.length} allVisibleSelected={visiveis.length > 0 && visiveis.every((item) => selected.has(item.id))} deleting={deleting} onToggleAll={() => setSelected((current) => visiveis.every((item) => current.has(item.id)) ? new Set() : new Set([...current, ...visiveis.map((item) => item.id)]))} onClear={() => setSelected(new Set())} onDelete={excluirSelecionados} />

      <Card>
        <div className="border-b border-[var(--border)] p-4">
          <ListControls
            search={busca}
            onSearchChange={setBusca}
            expanded={expandida}
            onExpandedChange={setExpandida}
            total={filtradas.length}
            visible={visiveis.length}
            label="Pesquisar insumos"
            placeholder="Código, nome, grupo ou unidade"
          >
            <div className="grid grid-cols-1 gap-3 sm:max-w-xs">
              <Select
                label="Status"
                value={statusFiltro}
                onChange={(e) => setStatusFiltro(e.target.value)}
                placeholder="todos"
                options={[
                  { value: "ativos", label: "ativos" },
                  { value: "baixo", label: "estoque baixo" },
                  { value: "zerado", label: "zerados" },
                  { value: "inativos", label: "inativos" },
                ]}
              />
            </div>
          </ListControls>
        </div>

        <div className="divide-y divide-[var(--border)] lg:hidden">
          {visiveis.map((item) => (
            <div key={item.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <input type="checkbox" aria-label={`Selecionar ${item.nome}`} checked={selected.has(item.id)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })} className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]" />
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
                    {item.codigo || item.grupo}
                  </p>
                  <p className="mt-1 break-words text-base font-bold text-[var(--text-primary)]">
                    {item.nome}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">
                    Saldo: <strong>{num(item.saldo_atual)} {item.unidade}</strong>
                  </p>
                </div>
                <Badge tone={statusTone(item)}>{statusLabel(item)}</Badge>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Button variant="secondary" onClick={() => setMovement({
                  insumo: item,
                  tipo: "entrada",
                  quantidade: "",
                  observacoes: "",
                })}>
                  Estoque
                </Button>
                <Button variant="secondary" onClick={() => setEditing(item)}>
                  Editar
                </Button>
                {item.ativo ? (
                  <Button variant="danger" onClick={() => inativar(item)}>
                    Inativar
                  </Button>
                ) : (
                  <Button variant="ghost" disabled>
                    Inativo
                  </Button>
                )}
              </div>
            </div>
          ))}
          {filtradas.length === 0 && !loading && (
            <div className="p-6 text-center text-sm font-semibold text-[var(--text-muted)]">
              Nenhum insumo encontrado.
            </div>
          )}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-card-alt)] text-left text-[var(--text-muted)]">
              <tr>
                <th className="w-10 px-4 py-2"><span className="sr-only">Selecionar</span></th>
                <th className="px-4 py-2 font-medium">Código</th>
                <th className="px-4 py-2 font-medium">Insumo</th>
                <th className="px-4 py-2 font-medium">Grupo</th>
                <th className="px-4 py-2 font-medium text-right">Saldo</th>
                <th className="px-4 py-2 font-medium text-right">Mínimo</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((item) => (
                <tr key={item.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-2"><input type="checkbox" aria-label={`Selecionar ${item.nome}`} checked={selected.has(item.id)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })} className="h-4 w-4 accent-[var(--accent)]" /></td>
                  <td className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)]">
                    {item.codigo || "—"}
                  </td>
                  <td className="px-4 py-2 font-semibold text-[var(--text-primary)]">
                    {item.nome}
                  </td>
                  <td className="px-4 py-2">{item.grupo}</td>
                  <td className="px-4 py-2 text-right tabular">
                    {num(item.saldo_atual)} {item.unidade}
                  </td>
                  <td className="px-4 py-2 text-right tabular">
                    {num(item.estoque_minimo)} {item.unidade}
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone={statusTone(item)}>{statusLabel(item)}</Badge>
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => setMovement({
                        insumo: item,
                        tipo: "entrada",
                        quantidade: "",
                        observacoes: "",
                      })}
                      className="mr-3 text-[var(--accent)] hover:underline"
                    >
                      estoque
                    </button>
                    <button
                      onClick={() => setEditing(item)}
                      className="mr-3 text-[var(--accent)] hover:underline"
                    >
                      editar
                    </button>
                    {item.ativo && (
                      <button
                        onClick={() => inativar(item)}
                        className="text-[var(--danger)] hover:underline"
                      >
                        inativar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtradas.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-[var(--text-muted)]">
                    Nenhum insumo encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 p-3 sm:items-center sm:p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-md space-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-[var(--text-primary)]">
              {editing.id ? "Editar insumo" : "Novo insumo"}
            </h3>
            <Input
              label="Código"
              value={editing.codigo ?? ""}
              onChange={(e) => setEditing({ ...editing, codigo: e.target.value })}
              placeholder="Opcional"
            />
            <Input
              label="Nome"
              value={editing.nome ?? ""}
              onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
            />
            <Input
              label="Grupo"
              value={editing.grupo ?? ""}
              onChange={(e) => setEditing({ ...editing, grupo: e.target.value })}
              placeholder="Herbicida, Formicida, Adubo..."
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Unidade"
                value={editing.unidade ?? ""}
                onChange={(e) => setEditing({ ...editing, unidade: e.target.value })}
              />
              <Input
                label="Estoque mínimo"
                type="number"
                step="0.01"
                value={String(editing.estoque_minimo ?? 0)}
                onChange={(e) => setEditing({ ...editing, estoque_minimo: Number(e.target.value) })}
              />
            </div>
            {editing.id && (
              <label className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                <input
                  type="checkbox"
                  checked={editing.ativo !== false}
                  onChange={(e) => setEditing({ ...editing, ativo: e.target.checked })}
                />
                Ativo para apontamento
              </label>
            )}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button onClick={salvar}>Salvar</Button>
            </div>
          </div>
        </div>
      )}

      {movement && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 p-3 sm:items-center sm:p-4"
          onClick={() => setMovement(null)}
        >
          <div
            className="w-full max-w-md space-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                Atualizar estoque
              </h3>
              <p className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">
                {movement.insumo.nome} · saldo atual {num(movement.insumo.saldo_atual)} {movement.insumo.unidade}
              </p>
            </div>
            <Select
              label="Tipo"
              value={movement.tipo}
              onChange={(e) =>
                setMovement({ ...movement, tipo: e.target.value as "entrada" | "ajuste" })
              }
              options={[
                { value: "entrada", label: "Entrada de estoque" },
                { value: "ajuste", label: "Ajuste (+/-)" },
              ]}
            />
            <Input
              label="Quantidade"
              type="number"
              step="0.01"
              value={movement.quantidade}
              onChange={(e) => setMovement({ ...movement, quantidade: e.target.value })}
              hint={movement.tipo === "ajuste" ? "Use negativo para reduzir saldo." : undefined}
            />
            <Input
              label="Observações"
              value={movement.observacoes}
              onChange={(e) => setMovement({ ...movement, observacoes: e.target.value })}
              placeholder="Nota, compra, correção ou justificativa"
            />
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button variant="ghost" onClick={() => setMovement(null)}>
                Cancelar
              </Button>
              <Button onClick={salvarMovimento}>Salvar</Button>
            </div>
          </div>
        </div>
      )}
      <BulkImportDialog open={bulkOpen} title="Importar insumos em lote" description="Cadastre o catálogo. Os saldos continuam sendo informados depois, nas movimentações de estoque." columns={SUPPLY_COLUMNS} onClose={() => setBulkOpen(false)} onImportRow={importar} onComplete={carregar} />
    </div>
  );
}
