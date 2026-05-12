"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
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
  const today = new Date();
  const [items, setItems] = useState<Meta[]>([]);
  const [ano, setAno] = useState(String(today.getFullYear()));
  const [mes, setMes] = useState(String(today.getMonth() + 1));
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");

  async function carregar() {
    try {
      const resp = await fetch("/api/metas").then((r) => r.json());
      setItems(Array.isArray(resp.items) ? (resp.items as Meta[]) : []);
    } catch (err) {
      toast(`Erro ao carregar metas: ${(err as Error).message}`, "error");
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!valor || Number(valor) < 0) {
      toast("Informe a meta.", "error");
      return;
    }
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
    toast("Meta mensal salva.", "success");
    setValor("");
    setObs("");
    carregar();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Meta mensal</h1>
        <p className="text-sm font-bold text-[var(--color-ink-600)]">
          Define a meta de faturamento mensal usada no dashboard de todos os acessos.
        </p>
      </div>

      <Card className="p-5">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-[var(--color-ink-900)]">
            Definir meta de faturamento
          </h2>
          <p className="text-sm font-semibold text-[var(--color-ink-600)]">
            Usada no dashboard para calcular % atingido e meta do próximo dia.
          </p>
        </div>
        <form onSubmit={salvar} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            label="Ano"
            type="number"
            value={ano}
            onChange={(e) => setAno(e.target.value)}
          />
          <Select
            label="Mês"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            options={MESES.map((m, i) => ({ value: String(i + 1), label: m }))}
          />
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
            <Button type="submit" className="w-full">
              Salvar
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="border-b border-[var(--color-ink-100)] p-4">
          <h2 className="text-lg font-bold text-[var(--color-ink-900)]">
            Histórico de metas mensais
          </h2>
        </div>

        {/* Mobile */}
        <div className="divide-y divide-[var(--color-ink-100)] lg:hidden">
          {items.length === 0 ? (
            <p className="p-6 text-center text-sm font-semibold text-[var(--color-ink-600)]">
              Nenhuma meta cadastrada ainda.
            </p>
          ) : (
            items.map((m) => (
              <div key={m.id} className="p-4">
                <p className="text-base font-bold capitalize text-[var(--color-ink-900)]">
                  {MESES[m.mes - 1]}/{m.ano}
                </p>
                <p className="mt-1 text-xl font-bold text-[var(--color-gn-700)] tabular">
                  {brl(m.valor_meta)}
                </p>
                {m.observacoes && (
                  <p className="mt-2 text-sm font-semibold text-[var(--color-ink-700)]">
                    {m.observacoes}
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Desktop */}
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-ink-50)] text-left text-[var(--color-ink-500)]">
              <tr>
                <th className="px-4 py-2 font-bold">Período</th>
                <th className="px-4 py-2 text-right font-bold">Meta</th>
                <th className="px-4 py-2 font-bold">Observações</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-[var(--color-ink-500)]">
                    Nenhuma meta cadastrada ainda.
                  </td>
                </tr>
              ) : (
                items.map((m) => (
                  <tr key={m.id} className="border-t border-[var(--color-ink-100)]">
                    <td className="px-4 py-2 font-semibold capitalize">
                      {MESES[m.mes - 1]}/{m.ano}
                    </td>
                    <td className="px-4 py-2 text-right font-bold tabular">
                      {brl(m.valor_meta)}
                    </td>
                    <td className="px-4 py-2 font-semibold text-[var(--color-ink-700)]">
                      {m.observacoes}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
