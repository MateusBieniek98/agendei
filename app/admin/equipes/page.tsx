"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import ListControls, { searchItems, visibleItems } from "@/components/ui/ListControls";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import type { Equipe } from "@/lib/types";

export default function EquipesPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<Equipe[]>([]);
  const [editing, setEditing] = useState<Partial<Equipe> | null>(null);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("");
  const [expandida, setExpandida] = useState(false);

  async function carregar() {
    try {
      const r = await fetch("/api/equipes");
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error ?? r.statusText);
      setItems(Array.isArray(j.items) ? (j.items as Equipe[]) : []);
    } catch (err) {
      setItems([]);
      toast(`Erro ao carregar equipes: ${(err as Error).message}`, "error");
    }
  }
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvar() {
    if (!editing?.nome) { toast("Informe o nome.", "error"); return; }
    const url = editing.id ? `/api/equipes/${editing.id}` : "/api/equipes";
    const method = editing.id ? "PATCH" : "POST";
    const r = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nome: editing.nome,
        descricao: editing.descricao ?? null,
        ativo: editing.ativo ?? true,
      }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast(`Erro: ${j.error ?? r.statusText}`, "error");
      return;
    }
    toast("Equipe salva.", "success");
    setEditing(null);
    carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Inativar equipe?")) return;
    const r = await fetch(`/api/equipes/${id}`, { method: "DELETE" });
    if (!r.ok) { toast("Erro.", "error"); return; }
    toast("Equipe inativada.", "success");
    carregar();
  }

  const filtradas = searchItems(
    items.filter((e) =>
      statusFiltro === "ativas" ? e.ativo : statusFiltro === "inativas" ? !e.ativo : true
    ),
    busca,
    [(e) => e.nome, (e) => e.descricao]
  );
  const visiveis = visibleItems(filtradas, expandida, 20);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Equipes / frentes</h1>
          <p className="text-sm font-semibold text-[var(--color-ink-600)]">Cadastre as frentes de trabalho.</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setEditing({ nome: "", descricao: "" })}>
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
            label="Pesquisar equipes"
            placeholder="Nome ou descrição"
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
          {visiveis.map((e) => (
            <div key={e.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-base font-bold text-[var(--color-ink-900)]">
                    {e.nome}
                  </p>
                  <p className="mt-1 break-words text-sm font-semibold text-[var(--color-ink-700)]">
                    {e.descricao || "Sem descrição"}
                  </p>
                </div>
                {e.ativo ? <Badge tone="success">ativa</Badge> : <Badge>inativa</Badge>}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => setEditing(e)}>
                  Editar
                </Button>
                {e.ativo ? (
                  <Button variant="danger" onClick={() => excluir(e.id)}>
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
              Nenhuma equipe encontrada neste filtro.
            </div>
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-ink-50)] text-[var(--color-ink-500)] text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Nome</th>
                <th className="px-4 py-2 font-medium">Descrição</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((e) => (
                <tr key={e.id} className="border-t border-[var(--color-ink-100)]">
                  <td className="px-4 py-2">{e.nome}</td>
                  <td className="px-4 py-2 text-[var(--color-ink-700)]">{e.descricao}</td>
                  <td className="px-4 py-2">
                    {e.ativo ? <Badge tone="success">ativa</Badge> : <Badge>inativa</Badge>}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => setEditing(e)}
                      className="text-[var(--color-gn-700)] hover:underline mr-3"
                    >editar</button>
                    {e.ativo && (
                      <button
                        onClick={() => excluir(e.id)}
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
               onClick={(ev) => ev.stopPropagation()}>
            <h3 className="text-lg font-bold">{editing.id ? "Editar" : "Nova"} equipe</h3>
            <Input
              label="Nome"
              value={editing.nome ?? ""}
              onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
            />
            <Input
              label="Descrição"
              value={editing.descricao ?? ""}
              onChange={(e) => setEditing({ ...editing, descricao: e.target.value })}
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
