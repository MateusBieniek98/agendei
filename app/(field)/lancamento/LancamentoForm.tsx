"use client";

import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { brl, todayISO } from "@/lib/format";
import type { Atividade, Equipe, Projeto } from "@/lib/types";

function emptyInsumos() {
  return Array.from({ length: 5 }, () => ({ nome: "", quantidade: "" }));
}

export default function LancamentoForm({
  equipes,
  atividades,
  projetos,
}: {
  equipes: Equipe[];
  atividades: Atividade[];
  projetos: Projeto[];
}) {
  const { toast } = useToast();
  const [data, setData] = useState(todayISO());
  const [equipeId, setEquipeId] = useState(equipes[0]?.id ?? "");
  const [atividadeId, setAtividadeId] = useState(atividades[0]?.id ?? "");
  const [projetoId, setProjetoId] = useState(projetos[0]?.id ?? "");
  const [talhao, setTalhao] = useState("");
  const [qtd, setQtd] = useState("");
  const [descarte, setDescarte] = useState("");
  const [insumos, setInsumos] = useState(emptyInsumos);
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);

  const atividade = useMemo(
    () => atividades.find((a) => a.id === atividadeId),
    [atividades, atividadeId]
  );
  const valorEstimado =
    atividade && qtd ? Number(qtd) * Number(atividade.valor_unitario) : 0;

  const insumosValidos = useMemo(
    () =>
      insumos
        .map((insumo) => ({
          nome: insumo.nome.trim(),
          quantidade: Number(insumo.quantidade),
        }))
        .filter(
          (insumo) =>
            insumo.nome &&
            Number.isFinite(insumo.quantidade) &&
            insumo.quantidade > 0
        ),
    [insumos]
  );

  function alterarInsumo(
    index: number,
    campo: "nome" | "quantidade",
    valor: string
  ) {
    setInsumos((atuais) =>
      atuais.map((insumo, i) => (i === index ? { ...insumo, [campo]: valor } : insumo))
    );
  }

  function limparFormulario() {
    setQtd("");
    setTalhao("");
    setDescarte("");
    setInsumos(emptyInsumos());
    setObs("");
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!equipeId || !atividadeId || !projetoId || !talhao.trim() || !qtd || Number(qtd) <= 0) {
      toast("Preencha equipe, atividade, projeto, talhão e quantidade.", "error");
      return;
    }
    setEnviando(true);
    const descarteValue = descarte === "" ? null : Number(descarte);
    try {
      const r = await fetch("/api/producao", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          data,
          equipe_id: equipeId,
          atividade_id: atividadeId,
          projeto_id: projetoId,
          talhao: talhao.trim(),
          quantidade: Number(qtd),
          descarte: descarteValue,
          insumos: insumosValidos,
          observacoes: obs || null,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? "Falha ao salvar");
      }
      toast("Produção registrada!", "success");
      limparFormulario();
    } catch (err) {
      // fallback offline: guarda no localStorage para reenvio depois
      try {
        const pend = JSON.parse(localStorage.getItem("gn:pendentes") ?? "[]");
        pend.push({
          data,
          equipe_id: equipeId,
          atividade_id: atividadeId,
          projeto_id: projetoId,
          talhao: talhao.trim(),
          quantidade: Number(qtd),
          descarte: descarteValue,
          insumos: insumosValidos,
          observacoes: obs || null,
          ts: Date.now(),
        });
        localStorage.setItem("gn:pendentes", JSON.stringify(pend));
        toast("Sem conexão — salvo offline. Reenviaremos depois.", "info");
        limparFormulario();
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

      <Select
        label="Projeto"
        value={projetoId}
        onChange={(e) => setProjetoId(e.target.value)}
        options={projetos.map((p) => ({ value: p.id, label: p.nome }))}
        placeholder="Selecione…"
      />

      <Input
        label="Talhão"
        value={talhao}
        onChange={(e) => setTalhao(e.target.value)}
        placeholder="Ex.: 017-01"
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

      <Card className="p-4 space-y-4">
        <div>
          <h3 className="text-base font-bold text-[var(--color-ink-900)]">
            Insumos utilizados
          </h3>
          <p className="mt-1 text-sm font-semibold text-[var(--color-ink-600)]">
            Opcional. Essa informação fica operacional e não aparece para o gestor.
          </p>
        </div>

        <div className="space-y-3">
          {insumos.map((insumo, index) => (
            <div key={index} className="grid grid-cols-[1fr_7rem] gap-3">
              <Input
                label={`Insumo ${index + 1}`}
                value={insumo.nome}
                onChange={(e) => alterarInsumo(index, "nome", e.target.value)}
                placeholder="Ex.: GEL"
              />
              <Input
                label="Qtd"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={insumo.quantidade}
                onChange={(e) => alterarInsumo(index, "quantidade", e.target.value)}
                placeholder="0"
              />
            </div>
          ))}
        </div>

        <Input
          label="Descarte (opcional)"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={descarte}
          onChange={(e) => setDescarte(e.target.value)}
          placeholder="Quantidade descartada"
        />
      </Card>

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
