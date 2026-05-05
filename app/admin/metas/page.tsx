"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { brl } from "@/lib/format";
import type { Meta } from "@/lib/types";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export default function MetasPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<Meta[]>([]);
  const today = new Date();
  const [ano, setAno] = useState(String(today.getFullYear()));
  const [mes, setMes] = useState(String(today.getMonth() + 1));
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");

  async function carregar() {
    try {
      const r = await fetch("/api/metas");
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error ?? r.statusText);
      setItems(Array.isArray(j.items) ? (j.items as Meta[]) : []);
    } catch (err) {
      setItems([]);
      toast(`Erro ao carregar metas: ${(err as Error).message}`, "error");
    }
  }
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!valor || Number(valor) < 0) { toast("Informe a meta.", "error"); return; }
    const r = await fetch("/api/metas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ano: Number(ano),
        mes: Number(mes),
        valor_meta: Number(valor),
        observacoes: obs || null,
      }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast(`Erro: ${j.error ?? r.statusText}`, "error");
      return;
    }
    toast("Meta salva.", "success");
    setValor(""); setObs("");
    carregar();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Metas mensais</h1>
        <p className="text-sm text-[var(--color-ink-500)]">
          Defina o valor de faturamento alvo para cada mês. O dashboard usa esse
          valor para calcular % atingido e meta do próximo dia.
        </p>
      </div>

      <Card className="p-5">
        <form onSubmit={salvar} className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Input label="Ano" type="number" value={ano} onChange={(e) => setAno(e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-[var(--color-ink-900)]">Mês</label>
            <select
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="h-13 min-h-12 rounded-xl border-2 border-[var(--color-ink-300)] bg-white px-3 font-semibold text-[var(--color-ink-900)] shadow-sm"
            >
              {MESES.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <Input
            label="Valor meta (R$)"
            type="number"
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="ex.: 120000"
          />
          <Input
            label="Observações"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="opcional"
          />
          <div className="flex items-end">
            <Button type="submit" className="w-full">Salvar</Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-ink-50)] text-[var(--color-ink-500)] text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Período</th>
                <th className="px-4 py-2 font-medium text-right">Meta</th>
                <th className="px-4 py-2 font-medium">Observações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} className="border-t border-[var(--color-ink-100)]">
                  <td className="px-4 py-2 capitalize">
                    {MESES[m.mes - 1]}/{m.ano}
                  </td>
                  <td className="px-4 py-2 text-right tabular font-semibold">
                    {brl(m.valor_meta)}
                  </td>
                  <td className="px-4 py-2 text-[var(--color-ink-700)]">{m.observacoes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
