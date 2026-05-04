"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import type { Equipe } from "@/lib/types";

export default function EquipesPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<Equipe[]>([]);
  const [editing, setEditing] = useState<Partial<Equipe> | null>(null);

  async function carregar() {
    const r = await fetch("/api/equipes");
    const j = await r.json();
    setItems((j.items ?? []) as Equipe[]);
  }
  useEffect(() => {
    carregar();
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

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Equipes / frentes</h1>
          <p className="text-sm text-[var(--color-ink-500)]">Cadastre as frentes de trabalho.</p>
        </div>
        <Button onClick={() => setEditing({ nome: "", descricao: "" })}>+ Nova</Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
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
              {items.map((e) => (
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
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button onClick={salvar}>Salvar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
