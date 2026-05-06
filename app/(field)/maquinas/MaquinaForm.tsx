"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Badge from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import type { MachineStatus, Maquina } from "@/lib/types";

const STATUS_OPTS: { value: MachineStatus; label: string }[] = [
  { value: "operando", label: "Funcionando / operando" },
  { value: "parada", label: "Parada" },
  { value: "manutencao_urgente", label: "Manutenção urgente" },
];

export default function MaquinaForm({ maquinas }: { maquinas: Maquina[] }) {
  const { toast } = useToast();
  const [items, setItems] = useState<Maquina[]>(maquinas);
  const [maquinaId, setMaquinaId] = useState(items[0]?.id ?? "");
  const maquinaSelecionada = useMemo(
    () => items.find((m) => m.id === maquinaId),
    [items, maquinaId]
  );
  const [statusMaquina, setStatusMaquina] = useState<MachineStatus>(
    maquinaSelecionada?.status === "operando"
      ? "manutencao_urgente"
      : (maquinaSelecionada?.status ?? "manutencao_urgente")
  );
  const [descricao, setDescricao] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setItems(maquinas);
    setMaquinaId((atual) => atual || maquinas[0]?.id || "");
  }, [maquinas]);

  useEffect(() => {
    setStatusMaquina(
      maquinaSelecionada?.status === "operando"
        ? "manutencao_urgente"
        : (maquinaSelecionada?.status ?? "manutencao_urgente")
    );
  }, [maquinaSelecionada]);

  function atualizarLocal(id: string, status: MachineStatus) {
    setItems((cur) => cur.map((m) => (m.id === id ? { ...m, status } : m)));
  }

  async function alterarStatus(id: string, status: MachineStatus) {
    const r = await fetch(`/api/maquinas/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast(`Erro ao alterar status: ${j.error ?? r.statusText}`, "error");
      return;
    }
    atualizarLocal(id, status);
    toast("Status da máquina atualizado.", "success");
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!maquinaId || !descricao.trim()) {
      toast("Selecione a máquina e descreva o problema.", "error");
      return;
    }
    setEnviando(true);
    try {
      const r = await fetch("/api/manutencoes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          maquina_id: maquinaId,
          descricao,
          status_maquina: statusMaquina,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? "Falha ao reportar");
      }
      toast("Problema reportado para a manutenção.", "success");
      atualizarLocal(maquinaId, statusMaquina);
      setDescricao("");
    } catch (err) {
      toast(`Erro: ${(err as Error).message}`, "error");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      <Select
        label="Máquina"
        value={maquinaId}
        onChange={(e) => setMaquinaId(e.target.value)}
        options={items.map((m) => ({
          value: m.id,
          label: m.identificador ? `${m.nome} · ${m.identificador}` : m.nome,
        }))}
        placeholder="Selecione…"
      />

      <Select
        label="Novo status"
        value={statusMaquina}
        onChange={(e) => setStatusMaquina(e.target.value as MachineStatus)}
        options={STATUS_OPTS}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-bold text-[var(--color-ink-900)]">
          Descrição do problema
        </label>
        <textarea
          rows={4}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="rounded-xl border-2 border-[var(--color-ink-300)] bg-white px-3 py-2 text-base font-semibold text-[var(--color-ink-900)] shadow-sm placeholder:font-semibold placeholder:text-[var(--color-ink-500)] focus:border-[var(--color-gn-500)] outline-none"
          placeholder="Ex.: motor desligando em alta rotação, vazamento de óleo…"
        />
      </div>

      <Button type="submit" size="field" loading={enviando}>
        Reportar problema
      </Button>

      <div className="pt-2">
        <h3 className="text-sm font-bold text-[var(--color-ink-900)]">
          Status atual da frota
        </h3>
        <div className="mt-2 grid grid-cols-1 gap-2">
          {items.map((m) => (
            <Card key={m.id} className="p-3 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">{m.nome}</p>
                  <p className="text-xs font-semibold text-[var(--color-ink-500)]">
                    {m.tipo}
                    {m.identificador ? ` · ${m.identificador}` : ""}
                  </p>
                </div>
                {m.status === "operando" ? (
                  <Badge tone="success">operando</Badge>
                ) : m.status === "parada" ? (
                  <Badge tone="warning">parada</Badge>
                ) : (
                  <Badge tone="danger">manutenção urgente</Badge>
                )}
              </div>
              <select
                value={m.status}
                onChange={(e) => alterarStatus(m.id, e.target.value as MachineStatus)}
                className="h-11 w-full rounded-lg border-2 border-[var(--color-ink-300)] bg-white px-3 text-sm font-semibold text-[var(--color-ink-900)] shadow-sm"
              >
                {STATUS_OPTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Card>
          ))}
        </div>
      </div>
    </form>
  );
}
