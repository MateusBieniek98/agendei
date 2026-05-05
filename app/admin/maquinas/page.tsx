"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { ddmmyyyy } from "@/lib/format";
import type { Maquina, MachineStatus, Manutencao } from "@/lib/types";

type ManutComMaquina = Manutencao & {
  maquinas: { nome: string; identificador: string | null } | null;
};

const STATUS_OPTS: { value: MachineStatus; label: string }[] = [
  { value: "operando", label: "Operando" },
  { value: "parada", label: "Parada" },
  { value: "manutencao_urgente", label: "Manutenção urgente" },
];

function statusTexto(status: string | null | undefined) {
  return (status ?? "sem_status").replaceAll("_", " ");
}

export default function MaquinasAdminPage() {
  const { toast } = useToast();
  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [manuts, setManuts] = useState<ManutComMaquina[]>([]);
  const [editing, setEditing] = useState<Partial<Maquina> | null>(null);

  async function carregar() {
    try {
      const [mr, mn] = await Promise.all([
        fetch("/api/maquinas").then((r) => r.json()),
        fetch("/api/manutencoes").then((r) => r.json()),
      ]);
      setMaquinas(Array.isArray(mr.items) ? (mr.items as Maquina[]) : []);
      setManuts(Array.isArray(mn.items) ? (mn.items as ManutComMaquina[]) : []);
    } catch (err) {
      setMaquinas([]);
      setManuts([]);
      toast(`Erro ao carregar máquinas: ${(err as Error).message}`, "error");
    }
  }
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvar() {
    if (!editing?.nome || !editing.tipo) {
      toast("Preencha nome e tipo.", "error");
      return;
    }
    const url = editing.id ? `/api/maquinas/${editing.id}` : "/api/maquinas";
    const method = editing.id ? "PATCH" : "POST";
    const r = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nome: editing.nome,
        tipo: editing.tipo,
        identificador: editing.identificador ?? null,
        status: editing.status ?? "operando",
        ativo: editing.ativo ?? true,
      }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast(`Erro: ${j.error ?? r.statusText}`, "error");
      return;
    }
    toast("Máquina salva.", "success");
    setEditing(null);
    carregar();
  }

  async function alterarStatus(id: string, status: MachineStatus) {
    const r = await fetch(`/api/maquinas/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!r.ok) toast("Erro.", "error");
    else carregar();
  }

  async function resolverManut(id: string) {
    const r = await fetch(`/api/manutencoes/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "resolvido" }),
    });
    if (!r.ok) toast("Erro.", "error");
    else { toast("Marcada como resolvida.", "success"); carregar(); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Máquinas</h1>
          <p className="text-sm text-[var(--color-ink-500)]">
            Cadastre a frota e gerencie manutenções abertas.
          </p>
        </div>
        <Button onClick={() => setEditing({ nome: "", tipo: "Trator", status: "operando" })}>
          + Nova
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-ink-50)] text-[var(--color-ink-500)] text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Nome</th>
                <th className="px-4 py-2 font-medium">Tipo</th>
                <th className="px-4 py-2 font-medium">Identificador</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {maquinas.map((m) => (
                <tr key={m.id} className="border-t border-[var(--color-ink-100)]">
                  <td className="px-4 py-2">{m.nome}</td>
                  <td className="px-4 py-2">{m.tipo}</td>
                  <td className="px-4 py-2">{m.identificador}</td>
                  <td className="px-4 py-2">
                    <select
                      value={m.status}
                      onChange={(e) => alterarStatus(m.id, e.target.value as MachineStatus)}
                      className="border border-[var(--color-ink-300)] rounded-md text-sm px-2 py-1"
                    >
                      {STATUS_OPTS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => setEditing(m)}
                      className="text-[var(--color-gn-700)] hover:underline"
                    >editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="px-5 py-3 border-b border-[var(--color-ink-100)]">
          <h3 className="font-semibold">Manutenções</h3>
        </div>
        <ul className="divide-y divide-[var(--color-ink-100)]">
          {manuts.map((m) => (
            <li key={m.id} className="px-5 py-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">
                  {m.maquinas?.nome}
                  {m.maquinas?.identificador && (
                    <span className="text-[var(--color-ink-500)]"> · {m.maquinas.identificador}</span>
                  )}
                </p>
                <p className="text-sm text-[var(--color-ink-700)]">{m.descricao}</p>
                <p className="text-xs text-[var(--color-ink-500)] mt-1">
                  Aberto em {ddmmyyyy(m.created_at)}
                </p>
              </div>
              <div className="text-right shrink-0 space-y-2">
                <Badge tone={m.status === "resolvido" ? "success" : m.status === "aberto" ? "danger" : "warning"}>
                  {statusTexto(m.status)}
                </Badge>
                {m.status !== "resolvido" && (
                  <button
                    onClick={() => resolverManut(m.id)}
                    className="block text-xs text-[var(--color-forest-700)] hover:underline"
                  >
                    marcar resolvida
                  </button>
                )}
              </div>
            </li>
          ))}
          {manuts.length === 0 && (
            <li className="px-5 py-6 text-sm text-[var(--color-ink-500)] text-center">
              Sem manutenções registradas.
            </li>
          )}
        </ul>
      </Card>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
             onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-3"
               onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">{editing.id ? "Editar" : "Nova"} máquina</h3>
            <Input label="Nome" value={editing.nome ?? ""}
                   onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
            <Input label="Tipo" hint="ex: Trator, Roçadeira, Pulverizador"
                   value={editing.tipo ?? ""}
                   onChange={(e) => setEditing({ ...editing, tipo: e.target.value })} />
            <Input label="Identificador / patrimônio"
                   value={editing.identificador ?? ""}
                   onChange={(e) => setEditing({ ...editing, identificador: e.target.value })} />
            <Select
              label="Status"
              value={editing.status ?? "operando"}
              onChange={(e) => setEditing({ ...editing, status: e.target.value as MachineStatus })}
              options={STATUS_OPTS}
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
