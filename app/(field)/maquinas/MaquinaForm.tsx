"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Badge from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import type { Maquina } from "@/lib/types";

export default function MaquinaForm({ maquinas }: { maquinas: Maquina[] }) {
  const { toast } = useToast();
  const [maquinaId, setMaquinaId] = useState(maquinas[0]?.id ?? "");
  const [descricao, setDescricao] = useState("");
  const [enviando, setEnviando] = useState(false);

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
        body: JSON.stringify({ maquina_id: maquinaId, descricao }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? "Falha ao reportar");
      }
      toast("Problema reportado para a manutenção.", "success");
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
        options={maquinas.map((m) => ({
          value: m.id,
          label: m.identificador ? `${m.nome} · ${m.identificador}` : m.nome,
        }))}
        placeholder="Selecione…"
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[var(--color-ink-700)]">
          Descrição do problema
        </label>
        <textarea
          rows={4}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="rounded-xl border border-[var(--color-ink-300)] bg-white px-3 py-2 text-base focus:border-[var(--color-gn-500)] outline-none"
          placeholder="Ex.: motor desligando em alta rotação, vazamento de óleo…"
        />
      </div>

      <Button type="submit" size="field" loading={enviando}>
        Reportar problema
      </Button>

      <div className="pt-2">
        <h3 className="text-sm font-semibold text-[var(--color-ink-700)]">
          Status atual da frota
        </h3>
        <div className="mt-2 grid grid-cols-1 gap-2">
          {maquinas.map((m) => (
            <Card key={m.id} className="p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{m.nome}</p>
                <p className="text-xs text-[var(--color-ink-500)]">
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
            </Card>
          ))}
        </div>
      </div>
    </form>
  );
}
