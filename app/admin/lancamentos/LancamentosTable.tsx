"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { brl, ddmmyyyy, num } from "@/lib/format";
import type { Atividade, Equipe, Projeto } from "@/lib/types";

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
}: {
  equipes: Equipe[];
  atividades: Atividade[];
  projetos: Projeto[];
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
  const [editing, setEditing] = useState<Linha | null>(null);

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

  const total = useMemo(
    () =>
      items.reduce(
        (s, l) => s + Number(l.quantidade) * Number(l.valor_unitario_snapshot),
        0
      ),
    [items]
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

  return (
    <div className="space-y-4">
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
        <div className="flex flex-col gap-1 border-b border-[var(--color-ink-100)] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold">
            <strong>{items.length}</strong> lançamento{items.length === 1 ? "" : "s"}
          </p>
          <p className="text-sm font-semibold">
            Total: <strong className="tabular">{brl(total)}</strong>
          </p>
        </div>

        <div className="divide-y divide-[var(--color-ink-100)] md:hidden">
          {items.map((l) => (
            <div key={l.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[var(--color-ink-600)]">
                    {ddmmyyyy(l.data)}
                  </p>
                  <p className="mt-1 break-words text-base font-bold text-[var(--color-ink-900)]">
                    {l.atividades?.nome ?? "Atividade"}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--color-ink-700)]">
                    {l.equipes?.nome ?? "Equipe não informada"}
                  </p>
                </div>
                <p className="shrink-0 text-right text-sm font-bold text-[var(--color-gn-700)] tabular">
                  {brl(Number(l.quantidade) * Number(l.valor_unitario_snapshot))}
                </p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-[var(--color-ink-50)] p-3">
                  <p className="text-xs font-bold uppercase text-[var(--color-ink-600)]">Produção</p>
                  <p className="mt-1 font-bold tabular">
                    {num(l.quantidade)} {l.atividades?.unidade}
                  </p>
                </div>
                <div className="rounded-xl bg-[var(--color-ink-50)] p-3">
                  <p className="text-xs font-bold uppercase text-[var(--color-ink-600)]">Tarifa</p>
                  <p className="mt-1 font-bold tabular">{brl(l.valor_unitario_snapshot)}</p>
                </div>
              </div>

              <div className="mt-3 rounded-xl bg-[var(--color-ink-50)] p-3 text-sm font-semibold text-[var(--color-ink-700)]">
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
          {items.length === 0 && !loading && (
            <div className="p-6 text-center text-sm font-semibold text-[var(--color-ink-600)]">
              Nenhum lançamento encontrado.
            </div>
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-ink-50)] text-[var(--color-ink-500)] text-left">
              <tr>
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
              {items.map((l) => (
                <tr key={l.id} className="border-t border-[var(--color-ink-100)]">
                  <td className="px-4 py-2 whitespace-nowrap">{ddmmyyyy(l.data)}</td>
                  <td className="px-4 py-2">{l.equipes?.nome}</td>
                  <td className="px-4 py-2">{l.atividades?.nome}</td>
                  <td className="px-4 py-2">
                    <p className="font-semibold">{l.projetos?.nome ?? "—"}</p>
                    <p className="text-xs text-[var(--color-ink-500)]">{l.talhao ?? "—"}</p>
                  </td>
                  <td className="px-4 py-2 max-w-xs whitespace-pre-line text-xs text-[var(--color-ink-500)]">
                    {l.insumos && l.insumos.length > 0 ? (
                      <div className="font-semibold text-[var(--color-ink-700)]">
                        {l.insumos
                          .map((i) => `${i.nome} (${num(i.quantidade)})`)
                          .join(", ")}
                      </div>
                    ) : null}
                    {l.descarte !== null ? (
                      <div className="mt-1 font-semibold text-[var(--color-ink-700)]">
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
                      className="text-[var(--color-gn-700)] hover:underline mr-3"
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
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-[var(--color-ink-500)]">
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
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
          onClick={() => setEditing(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-6 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold">Editar lançamento</h3>
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
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button onClick={salvarEdit}>Salvar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
