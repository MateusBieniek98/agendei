"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import ListControls, { searchItems, visibleItems } from "@/components/ui/ListControls";
import { useToast } from "@/components/ui/Toast";
import { brl, ddmmyyyy, num } from "@/lib/format";
import type { Atividade, Equipe, Insumo, Projeto } from "@/lib/types";
import BulkImportDialog, { type BulkImportColumn } from "@/components/bulk/BulkImportDialog";
import BulkSelectionBar from "@/components/bulk/BulkSelectionBar";
import { normalizeBulkValue, parseDatePtBr, parseNumberPtBr, responseError } from "@/lib/bulk-import";

const PRODUCTION_COLUMNS: BulkImportColumn[] = [
  { key: "data", label: "Data", example: "18/07/2026", required: true, validate: (value) => parseDatePtBr(value) ? null : "Data inválida." },
  { key: "equipe", label: "Equipe", example: "Equipe Norte", required: true },
  { key: "projeto", label: "Projeto", example: "Mãe Santa", required: true },
  { key: "talhao", label: "Talhão", example: "017-01", required: true, validate: (value) => /^\d{3}-\d{2}$/.test(value.trim()) ? null : "Talhão deve usar o formato 000-00." },
  { key: "servico", label: "Serviço", example: "Roçada manual", required: true },
  { key: "quantidade", label: "Quantidade", example: "12,5", required: true, validate: (value) => (parseNumberPtBr(value) ?? 0) > 0 ? null : "Quantidade inválida." },
  { key: "insumos", label: "Insumos", example: "INS-001:2,5 | Óleo:1" },
  { key: "descarte", label: "Descarte", example: "0" },
  { key: "observacoes", label: "Observações", example: "Concluído sem intercorrências" },
];

type Linha = {
  id: string;
  data: string;
  equipe_id: string;
  atividade_id: string;
  projeto_id: string | null;
  talhao: string | null;
  quantidade: number;
  descarte: number | null;
  insumos: { nome: string; quantidade: number }[] | null;
  observacoes: string | null;
  valor_unitario_snapshot: number;
  equipes: { nome: string } | null;
  atividades: { nome: string; unidade: string } | null;
  projetos: { nome: string } | null;
};

export default function LancamentosTable({
  equipes,
  atividades,
  projetos,
  insumos,
}: {
  equipes: Equipe[];
  atividades: Atividade[];
  projetos: Projeto[];
  insumos: Insumo[];
}) {
  const { toast } = useToast();
  const [items, setItems] = useState<Linha[]>([]);
  const [loading, setLoading] = useState(true);
  const [equipe, setEquipe] = useState("");
  const [atividade, setAtividade] = useState("");
  const [projeto, setProjeto] = useState("");
  const [talhao, setTalhao] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [busca, setBusca] = useState("");
  const [expandida, setExpandida] = useState(false);
  const [editing, setEditing] = useState<Linha | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (equipe) sp.set("equipe_id", equipe);
      if (atividade) sp.set("atividade_id", atividade);
      if (projeto) sp.set("projeto_id", projeto);
      if (talhao) sp.set("talhao", talhao);
      if (de) sp.set("data_de", de);
      if (ate) sp.set("data_ate", ate);
      const r = await fetch(`/api/producao?${sp.toString()}`);
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error ?? r.statusText);
      setItems(Array.isArray(j.items) ? (j.items as Linha[]) : []);
    } catch (err) {
      setItems([]);
      toast(`Erro ao carregar lançamentos: ${(err as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const itemsFiltrados = useMemo(
    () =>
      searchItems(items, busca, [
        (l) => l.equipes?.nome,
        (l) => l.atividades?.nome,
        (l) => l.projetos?.nome,
        (l) => l.talhao,
        (l) => l.data,
        (l) => l.observacoes,
        (l) => l.insumos?.map((i) => i.nome).join(" "),
      ]),
    [items, busca]
  );
  const itemsVisiveis = useMemo(
    () => visibleItems(itemsFiltrados, expandida, 20),
    [itemsFiltrados, expandida]
  );
  const total = useMemo(
    () =>
      itemsFiltrados.reduce(
        (s, l) => s + Number(l.quantidade) * Number(l.valor_unitario_snapshot),
        0
      ),
    [itemsFiltrados]
  );

  async function salvarEdit() {
    if (!editing) return;
    const r = await fetch(`/api/producao/${editing.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        data: editing.data,
        equipe_id: editing.equipe_id,
        atividade_id: editing.atividade_id,
        projeto_id: editing.projeto_id,
        talhao: editing.talhao,
        quantidade: editing.quantidade,
        observacoes: editing.observacoes,
      }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast(`Erro: ${j.error ?? r.statusText}`, "error");
      return;
    }
    toast("Lançamento atualizado.", "success");
    setEditing(null);
    carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este lançamento?")) return;
    const r = await fetch(`/api/producao/${id}`, { method: "DELETE" });
    if (!r.ok) {
      toast("Erro ao excluir.", "error");
      return;
    }
    toast("Excluído.", "success");
    carregar();
  }

  function findByName<T extends { nome: string }>(list: T[], value: string, label: string) {
    const normalized = normalizeBulkValue(value);
    const item = list.find((candidate) => normalizeBulkValue(candidate.nome) === normalized);
    if (!item) throw new Error(`${label} não encontrado: ${value}`);
    return item;
  }

  function parseImportedSupplies(value: string) {
    if (!value.trim()) return [];
    return value.split("|").map((entry) => {
      const separator = entry.lastIndexOf(":");
      if (separator < 1) throw new Error(`Insumo inválido: ${entry.trim()}`);
      const reference = entry.slice(0, separator).trim();
      const quantity = parseNumberPtBr(entry.slice(separator + 1));
      const normalized = normalizeBulkValue(reference);
      const item = insumos.find((candidate) => normalizeBulkValue(candidate.codigo) === normalized || normalizeBulkValue(candidate.nome) === normalized);
      if (!item) throw new Error(`Insumo não encontrado: ${reference}`);
      if (!quantity || quantity <= 0) throw new Error(`Quantidade inválida para ${reference}`);
      return { insumo_id: item.id, nome: item.nome, unidade: item.unidade, quantidade: quantity };
    });
  }

  async function importar(values: Record<string, string>) {
    const equipeItem = findByName(equipes, values.equipe, "Equipe");
    const atividadeItem = findByName(atividades, values.servico, "Serviço");
    const projetoItem = findByName(projetos, values.projeto, "Projeto");
    await responseError(await fetch("/api/producao", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        data: parseDatePtBr(values.data),
        equipe_id: equipeItem.id,
        atividade_id: atividadeItem.id,
        projeto_id: projetoItem.id,
        talhao: values.talhao.trim(),
        quantidade: parseNumberPtBr(values.quantidade),
        insumos: parseImportedSupplies(values.insumos),
        descarte: parseNumberPtBr(values.descarte),
        observacoes: values.observacoes.trim() || null,
        client_id: `bulk-${crypto.randomUUID()}`,
      }),
    }));
  }

  async function excluirSelecionados() {
    if (!selected.size || !confirm(`Excluir ${selected.size} apontamento${selected.size === 1 ? "" : "s"}? As baixas de estoque serão estornadas.`)) return;
    setDeleting(true);
    let errors = 0;
    for (const id of selected) if (!(await fetch(`/api/producao/${id}`, { method: "DELETE" })).ok) errors += 1;
    setDeleting(false);
    setSelected(new Set());
    toast(errors ? `${errors} apontamento(s) não puderam ser excluídos.` : "Apontamentos excluídos.", errors ? "error" : "success");
    await carregar();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button variant="secondary" onClick={() => setBulkOpen(true)}>Importar em lote</Button></div>
      <BulkSelectionBar selectedCount={selected.size} visibleCount={itemsVisiveis.length} allVisibleSelected={itemsVisiveis.length > 0 && itemsVisiveis.every((item) => selected.has(item.id))} deleting={deleting} onToggleAll={() => setSelected((current) => itemsVisiveis.every((item) => current.has(item.id)) ? new Set() : new Set([...current, ...itemsVisiveis.map((item) => item.id)]))} onClear={() => setSelected(new Set())} onDelete={excluirSelecionados} />
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
          <Input label="De" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          <Input label="Até" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          <Select
            label="Equipe"
            value={equipe}
            onChange={(e) => setEquipe(e.target.value)}
            options={equipes.map((e) => ({ value: e.id, label: e.nome }))}
            placeholder="todas"
          />
          <Select
            label="Atividade"
            value={atividade}
            onChange={(e) => setAtividade(e.target.value)}
            options={atividades.map((a) => ({ value: a.id, label: a.nome }))}
            placeholder="todas"
          />
          <Select
            label="Projeto"
            value={projeto}
            onChange={(e) => setProjeto(e.target.value)}
            options={projetos.map((p) => ({ value: p.id, label: p.nome }))}
            placeholder="todos"
          />
          <Input label="Talhão" value={talhao} onChange={(e) => setTalhao(e.target.value)} />
          <div className="flex items-end">
            <Button onClick={carregar} className="w-full" loading={loading}>
              Filtrar
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="border-b border-[var(--border)] p-4">
          <ListControls
            search={busca}
            onSearchChange={setBusca}
            expanded={expandida}
            onExpandedChange={setExpandida}
            total={itemsFiltrados.length}
            visible={itemsVisiveis.length}
            label="Pesquisar resultados"
            placeholder="Projeto, talhão, atividade, equipe, insumo ou observação"
          />
        </div>
        <div className="flex flex-col gap-1 border-b border-[var(--border)] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold">
            <strong>{itemsFiltrados.length}</strong> lançamento{itemsFiltrados.length === 1 ? "" : "s"}
          </p>
          <p className="text-sm font-semibold">
            Total: <strong className="tabular">{brl(total)}</strong>
          </p>
        </div>

        <div className="divide-y divide-[var(--border)] lg:hidden">
          {itemsVisiveis.map((l) => (
            <div key={l.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <input type="checkbox" aria-label={`Selecionar apontamento de ${ddmmyyyy(l.data)}`} checked={selected.has(l.id)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(l.id)) next.delete(l.id); else next.add(l.id); return next; })} className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[var(--text-muted)]">
                    {ddmmyyyy(l.data)}
                  </p>
                  <p className="mt-1 break-words text-base font-bold text-[var(--text-primary)]">
                    {l.atividades?.nome ?? "Atividade"}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">
                    {l.equipes?.nome ?? "Equipe não informada"}
                  </p>
                </div>
                <p className="shrink-0 text-right text-sm font-bold text-[var(--accent)] tabular">
                  {brl(Number(l.quantidade) * Number(l.valor_unitario_snapshot))}
                </p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-[var(--bg-card-alt)] p-3">
                  <p className="text-xs font-bold uppercase text-[var(--text-muted)]">Produção</p>
                  <p className="mt-1 font-bold tabular">
                    {num(l.quantidade)} {l.atividades?.unidade}
                  </p>
                </div>
                <div className="rounded-lg bg-[var(--bg-card-alt)] p-3">
                  <p className="text-xs font-bold uppercase text-[var(--text-muted)]">Tarifa</p>
                  <p className="mt-1 font-bold tabular">{brl(l.valor_unitario_snapshot)}</p>
                </div>
              </div>

              <div className="mt-3 rounded-lg bg-[var(--bg-card-alt)] p-3 text-sm font-semibold text-[var(--text-secondary)]">
                <p>
                  Projeto: <strong>{l.projetos?.nome ?? "não informado"}</strong>
                </p>
                <p>Talhão: <strong>{l.talhao ?? "não informado"}</strong></p>
                {l.insumos && l.insumos.length > 0 && (
                  <p className="mt-2">
                    Insumos:{" "}
                    <strong>
                      {l.insumos
                        .map((i) => `${i.nome} (${num(i.quantidade)})`)
                        .join(", ")}
                    </strong>
                  </p>
                )}
                {l.descarte !== null && (
                  <p className="mt-1">
                    Descarte: <strong>{num(l.descarte)}</strong>
                  </p>
                )}
                {l.observacoes && <p className="mt-2">{l.observacoes}</p>}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => setEditing(l)}>
                  Editar
                </Button>
                <Button variant="danger" onClick={() => excluir(l.id)}>
                  Excluir
                </Button>
              </div>
            </div>
          ))}
          {itemsFiltrados.length === 0 && !loading && (
            <div className="p-6 text-center text-sm font-semibold text-[var(--text-muted)]">
              Nenhum lançamento encontrado.
            </div>
          )}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-card-alt)] text-left text-[var(--text-muted)]">
              <tr>
                <th className="w-10 px-4 py-2"><span className="sr-only">Selecionar</span></th>
                <th className="px-4 py-2 font-medium">Data</th>
                <th className="px-4 py-2 font-medium">Equipe</th>
                <th className="px-4 py-2 font-medium">Atividade</th>
                <th className="px-4 py-2 font-medium">Projeto / talhão</th>
                <th className="px-4 py-2 font-medium">Detalhes</th>
                <th className="px-4 py-2 font-medium text-right">Qtd</th>
                <th className="px-4 py-2 font-medium text-right">Valor</th>
                <th className="px-4 py-2 font-medium text-right">Total</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {itemsVisiveis.map((l) => (
                <tr key={l.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-2"><input type="checkbox" aria-label={`Selecionar apontamento de ${ddmmyyyy(l.data)}`} checked={selected.has(l.id)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(l.id)) next.delete(l.id); else next.add(l.id); return next; })} className="h-4 w-4 accent-[var(--accent)]" /></td>
                  <td className="px-4 py-2 whitespace-nowrap">{ddmmyyyy(l.data)}</td>
                  <td className="px-4 py-2">{l.equipes?.nome}</td>
                  <td className="px-4 py-2">{l.atividades?.nome}</td>
                  <td className="px-4 py-2">
                    <p className="font-semibold">{l.projetos?.nome ?? "—"}</p>
                    <p className="text-xs text-[var(--text-muted)]">{l.talhao ?? "—"}</p>
                  </td>
                  <td className="px-4 py-2 max-w-xs whitespace-pre-line text-xs text-[var(--text-muted)]">
                    {l.insumos && l.insumos.length > 0 ? (
                      <div className="font-semibold text-[var(--text-secondary)]">
                        {l.insumos
                          .map((i) => `${i.nome} (${num(i.quantidade)})`)
                          .join(", ")}
                      </div>
                    ) : null}
                    {l.descarte !== null ? (
                      <div className="mt-1 font-semibold text-[var(--text-secondary)]">
                        Descarte: {num(l.descarte)}
                      </div>
                    ) : null}
                    {l.observacoes ? (
                      <div className="mt-1">{l.observacoes}</div>
                    ) : !l.insumos?.length && l.descarte === null ? (
                      "—"
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-right tabular">
                    {num(l.quantidade)} {l.atividades?.unidade}
                  </td>
                  <td className="px-4 py-2 text-right tabular">{brl(l.valor_unitario_snapshot)}</td>
                  <td className="px-4 py-2 text-right tabular font-semibold">
                    {brl(Number(l.quantidade) * Number(l.valor_unitario_snapshot))}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => setEditing(l)}
                      className="mr-3 text-[var(--accent)] hover:underline"
                    >
                      editar
                    </button>
                    <button
                      onClick={() => excluir(l.id)}
                      className="text-[var(--color-danger-500)] hover:underline"
                    >
                      excluir
                    </button>
                  </td>
                </tr>
              ))}
              {itemsFiltrados.length === 0 && !loading && (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-[var(--text-muted)]">
                    Nenhum lançamento encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 p-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-[max(env(safe-area-inset-top),12px)] sm:items-center sm:p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="max-h-[calc(100dvh_-_24px_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom))] w-full max-w-md overflow-y-auto rounded-lg bg-[var(--bg-card)] p-5 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 -mx-5 -mt-5 mb-3 border-b border-[var(--border)] bg-[var(--bg-card)] px-5 py-4 sm:-mx-6 sm:-mt-6 sm:px-6">
              <h3 className="text-lg font-bold">Editar lançamento</h3>
              <p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">
                Ajuste os dados e salve sem perder a posição da página.
              </p>
            </div>
            <div className="space-y-3">
            <Input
              label="Data"
              type="date"
              value={editing.data}
              onChange={(e) => setEditing({ ...editing, data: e.target.value })}
            />
            <Select
              label="Equipe"
              value={editing.equipe_id}
              onChange={(e) => setEditing({ ...editing, equipe_id: e.target.value })}
              options={equipes.map((e) => ({ value: e.id, label: e.nome }))}
            />
            <Select
              label="Atividade"
              value={editing.atividade_id}
              onChange={(e) => setEditing({ ...editing, atividade_id: e.target.value })}
              options={atividades.map((a) => ({ value: a.id, label: a.nome }))}
            />
            <Select
              label="Projeto"
              value={editing.projeto_id ?? ""}
              onChange={(e) => setEditing({ ...editing, projeto_id: e.target.value || null })}
              options={projetos.map((p) => ({ value: p.id, label: p.nome }))}
              placeholder="Selecione…"
            />
            <Input
              label="Talhão"
              value={editing.talhao ?? ""}
              onChange={(e) => setEditing({ ...editing, talhao: e.target.value })}
            />
            <Input
              label="Quantidade"
              type="number"
              step="0.01"
              value={String(editing.quantidade)}
              onChange={(e) =>
                setEditing({ ...editing, quantidade: Number(e.target.value) })
              }
            />
            <Input
              label="Observações"
              value={editing.observacoes ?? ""}
              onChange={(e) => setEditing({ ...editing, observacoes: e.target.value })}
            />
              <div className="sticky bottom-0 -mx-5 -mb-5 grid grid-cols-2 gap-2 border-t border-[var(--border)] bg-[var(--bg-card)] px-5 py-4 sm:-mx-6 sm:-mb-6 sm:px-6">
                <Button variant="ghost" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
                <Button onClick={salvarEdit}>Salvar</Button>
              </div>
            </div>
          </div>
        </div>
      )}
      <BulkImportDialog open={bulkOpen} title="Importar apontamentos em lote" description="Cole lançamentos do Excel. Insumos são opcionais e usam o formato Código:Quantidade separados por |." columns={PRODUCTION_COLUMNS} onClose={() => setBulkOpen(false)} onImportRow={importar} onComplete={carregar} />
    </div>
  );
}
