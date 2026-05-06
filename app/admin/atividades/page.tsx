"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import ListControls, { searchItems, visibleItems } from "@/components/ui/ListControls";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { brl } from "@/lib/format";
import type { Atividade } from "@/lib/types";

export default function AtividadesPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<Atividade[]>([]);
  const [editing, setEditing] = useState<Partial<Atividade> | null>(null);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("");
  const [expandida, setExpandida] = useState(false);

  async function carregar() {
    try {
      const r = await fetch("/api/atividades");
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error ?? r.statusText);
      setItems(Array.isArray(j.items) ? (j.items as Atividade[]) : []);
    } catch (err) {
      setItems([]);
      toast(`Erro ao carregar atividades: ${(err as Error).message}`, "error");
    }
  }
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvar() {
    if (!editing?.nome || !editing.unidade || editing.valor_unitario === undefined) {
      toast("Preencha nome, unidade e valor.", "error");
      return;
    }
    const url = editing.id ? `/api/atividades/${editing.id}` : "/api/atividades";
    const method = editing.id ? "PATCH" : "POST";
    const r = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nome: editing.nome,
        unidade: editing.unidade,
        valor_unitario: Number(editing.valor_unitario),
        ativo: editing.ativo ?? true,
      }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast(`Erro: ${j.error ?? r.statusText}`, "error");
      return;
    }
    toast("Atividade salva.", "success");
    setEditing(null);
    carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Inativar atividade?")) return;
    const r = await fetch(`/api/atividades/${id}`, { method: "DELETE" });
    if (!r.ok) { toast("Erro ao excluir.", "error"); return; }
    toast("Atividade inativada.", "success");
    carregar();
  }

  const filtradas = searchItems(
    items.filter((a) =>
      statusFiltro === "ativas" ? a.ativo : statusFiltro === "inativas" ? !a.ativo : true
    ),
    busca,
    [(a) => a.nome, (a) => a.unidade, (a) => a.valor_unitario]
  );
  const visiveis = visibleItems(filtradas, expandida, 20);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Atividades</h1>
          <p className="text-sm font-semibold text-[var(--color-ink-600)]">
            Tipos de serviço e seus valores por unidade. O valor é capturado no
            lançamento — alterações futuras não afetam histórico.
          </p>
        </div>
        <Button
          className="w-full sm:w-auto"
          onClick={() => setEditing({ nome: "", unidade: "ha", valor_unitario: 0 })}
        >
          + Nova
        </Button>
      </div>

      <Card>
        <div className="border-b border-[var(--color-ink-100)] p-4">
          <ListControls
            search={busca}
            onSearchChange={setBusca}
            expanded={expandida}
            onExpandedChange={setExpandida}
            total={filtradas.length}
            visible={visiveis.length}
            label="Pesquisar atividades"
            placeholder="Nome, unidade ou tarifa"
          >
            <div className="grid grid-cols-1 gap-3 sm:max-w-xs">
              <label className="text-sm font-bold text-[var(--color-ink-900)]">
                Status
                <select
                  value={statusFiltro}
                  onChange={(e) => setStatusFiltro(e.target.value)}
                  className="mt-1 h-12 w-full rounded-xl border-2 border-[var(--color-ink-300)] bg-white px-3 text-base font-bold text-[var(--color-ink-900)] shadow-sm"
                >
                  <option value="">todas</option>
                  <option value="ativas">ativas</option>
                  <option value="inativas">inativas</option>
                </select>
              </label>
            </div>
          </ListControls>
        </div>
        <div className="divide-y divide-[var(--color-ink-100)] md:hidden">
          {visiveis.map((a) => (
            <div key={a.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-base font-bold text-[var(--color-ink-900)]">
                    {a.nome}
                  </p>
                  <p className="mt-1 text-sm font-bold text-[var(--color-gn-700)] tabular">
                    {brl(a.valor_unitario)} / {a.unidade}
                  </p>
                </div>
                {a.ativo ? (
                  <Badge tone="success">ativo</Badge>
                ) : (
                  <Badge>inativo</Badge>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => setEditing(a)}>
                  Editar
                </Button>
                {a.ativo ? (
                  <Button variant="danger" onClick={() => excluir(a.id)}>
                    Inativar
                  </Button>
                ) : (
                  <Button variant="ghost" disabled>
                    Inativa
                  </Button>
                )}
              </div>
            </div>
          ))}
          {filtradas.length === 0 && (
            <div className="p-6 text-center text-sm font-semibold text-[var(--color-ink-600)]">
              Nenhuma atividade encontrada neste filtro.
            </div>
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-ink-50)] text-[var(--color-ink-500)] text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Nome</th>
                <th className="px-4 py-2 font-medium">Unidade</th>
                <th className="px-4 py-2 font-medium text-right">Valor unitário</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((a) => (
                <tr key={a.id} className="border-t border-[var(--color-ink-100)]">
                  <td className="px-4 py-2">{a.nome}</td>
                  <td className="px-4 py-2">{a.unidade}</td>
                  <td className="px-4 py-2 text-right tabular">{brl(a.valor_unitario)}</td>
                  <td className="px-4 py-2">
                    {a.ativo ? <Badge tone="success">ativo</Badge> : <Badge>inativo</Badge>}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => setEditing(a)}
                      className="text-[var(--color-gn-700)] hover:underline mr-3"
                    >editar</button>
                    {a.ativo && (
                      <button
                        onClick={() => excluir(a.id)}
                        className="text-[var(--color-danger-500)] hover:underline"
                      >inativar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
             onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-3"
               onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">{editing.id ? "Editar" : "Nova"} atividade</h3>
            <Input
              label="Nome"
              value={editing.nome ?? ""}
              onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
            />
            <Input
              label="Unidade"
              hint="ex: ha, mudas, kg, m"
              value={editing.unidade ?? ""}
              onChange={(e) => setEditing({ ...editing, unidade: e.target.value })}
            />
            <Input
              label="Valor unitário (R$)"
              type="number"
              step="0.01"
              value={String(editing.valor_unitario ?? 0)}
              onChange={(e) => setEditing({ ...editing, valor_unitario: Number(e.target.value) })}
            />
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button onClick={salvar}>Salvar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
