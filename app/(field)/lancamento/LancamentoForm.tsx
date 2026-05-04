"use client";

import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { brl, todayISO } from "@/lib/format";
import type { Atividade, Equipe } from "@/lib/types";

export default function LancamentoForm({
  equipes,
  atividades,
}: {
  equipes: Equipe[];
  atividades: Atividade[];
}) {
  const { toast } = useToast();
  const [data, setData] = useState(todayISO());
  const [equipeId, setEquipeId] = useState(equipes[0]?.id ?? "");
  const [atividadeId, setAtividadeId] = useState(atividades[0]?.id ?? "");
  const [qtd, setQtd] = useState("");
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);

  const atividade = useMemo(
    () => atividades.find((a) => a.id === atividadeId),
    [atividades, atividadeId]
  );
  const valorEstimado =
    atividade && qtd ? Number(qtd) * Number(atividade.valor_unitario) : 0;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!equipeId || !atividadeId || !qtd || Number(qtd) <= 0) {
      toast("Preencha equipe, atividade e quantidade.", "error");
      return;
    }
    setEnviando(true);
    try {
      const r = await fetch("/api/producao", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          data,
          equipe_id: equipeId,
          atividade_id: atividadeId,
          quantidade: Number(qtd),
          observacoes: obs || null,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? "Falha ao salvar");
      }
      toast("Produção registrada!", "success");
      setQtd("");
      setObs("");
    } catch (err) {
      // fallback offline: guarda no localStorage para reenvio depois
      try {
        const pend = JSON.parse(localStorage.getItem("gn:pendentes") ?? "[]");
        pend.push({
          data,
          equipe_id: equipeId,
          atividade_id: atividadeId,
          quantidade: Number(qtd),
          observacoes: obs || null,
          ts: Date.now(),
        });
        localStorage.setItem("gn:pendentes", JSON.stringify(pend));
        toast("Sem conexão — salvo offline. Reenviaremos depois.", "info");
        setQtd("");
        setObs("");
      } catch {
        toast(`Erro: ${(err as Error).message}`, "error");
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      <Input
        label="Data"
        type="date"
        value={data}
        onChange={(e) => setData(e.target.value)}
      />

      <Select
        label="Equipe / frente"
        value={equipeId}
        onChange={(e) => setEquipeId(e.target.value)}
        options={equipes.map((e) => ({ value: e.id, label: e.nome }))}
        placeholder="Selecione…"
      />

      <Select
        label="Atividade"
        value={atividadeId}
        onChange={(e) => setAtividadeId(e.target.value)}
        options={atividades.map((a) => ({
          value: a.id,
          label: `${a.nome} · ${brl(a.valor_unitario)}/${a.unidade}`,
        }))}
        placeholder="Selecione…"
      />

      <Input
        label={`Quantidade${atividade ? ` (${atividade.unidade})` : ""}`}
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        value={qtd}
        onChange={(e) => setQtd(e.target.value)}
        placeholder="Ex.: 3.5"
      />

      <Input
        label="Observações (opcional)"
        value={obs}
        onChange={(e) => setObs(e.target.value)}
        placeholder="Ocorrências, clima, atrasos…"
      />

      <Card className="p-4 bg-[var(--color-gn-50)] border-[var(--color-gn-200)]">
        <p className="text-xs text-[var(--color-gn-700)] uppercase font-semibold tracking-wide">
          Valor estimado
        </p>
        <p className="mt-1 text-2xl font-bold text-[var(--color-gn-700)] tabular">
          {brl(valorEstimado)}
        </p>
      </Card>

      <Button type="submit" size="field" loading={enviando} className="btn-field">
        Registrar produção
      </Button>
    </form>
  );
}
