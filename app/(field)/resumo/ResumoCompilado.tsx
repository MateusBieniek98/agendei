"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import ListControls, { searchItems, visibleItems } from "@/components/ui/ListControls";
import { brl, ddmmyyyy, num } from "@/lib/format";

type Linha = {
  id: string;
  data: string;
  quantidade: number | string;
  talhao: string | null;
  observacoes: string | null;
  valor_unitario_snapshot: number | string;
  projetos: { nome: string } | null;
  atividades: { nome: string; unidade: string } | null;
};

export default function ResumoCompilado({
  linhas,
  totalFaturamento,
}: {
  linhas: Linha[];
  totalFaturamento: number;
}) {
  const [busca, setBusca] = useState("");
  const [expandido, setExpandido] = useState(false);
  const filtradas = useMemo(
    () =>
      searchItems(linhas, busca, [
        (linha) => linha.data,
        (linha) => linha.projetos?.nome,
        (linha) => linha.atividades?.nome,
        (linha) => linha.talhao,
        (linha) => linha.observacoes,
      ]),
    [linhas, busca]
  );
  const visiveis = useMemo(
    () => visibleItems(filtradas, expandido, 20),
    [filtradas, expandido]
  );
  const totalFiltrado = filtradas.reduce(
    (s, linha) =>
      s + Number(linha.quantidade ?? 0) * Number(linha.valor_unitario_snapshot ?? 0),
    0
  );

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-[var(--color-ink-900)]">
            Compilado geral
          </h3>
          <p className="text-sm font-semibold text-[var(--color-ink-600)]">
            Detalhe completo por projeto, atividade, talhão, data, hectares e faturamento.
          </p>
        </div>
        <p className="text-base font-bold text-[var(--color-gn-700)]">
          Total: {brl(totalFaturamento)}
        </p>
      </div>

      {linhas.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="font-semibold text-[var(--color-ink-600)]">
            Nenhum apontamento encontrado para este mês.
          </p>
        </Card>
      ) : (
        <>
          <ListControls
            search={busca}
            onSearchChange={setBusca}
            expanded={expandido}
            onExpandedChange={setExpandido}
            total={filtradas.length}
            visible={visiveis.length}
            label="Pesquisar apontamentos"
            placeholder="Data, projeto, atividade, talhão ou observação"
          />
          <p className="text-sm font-bold text-[var(--color-gn-700)]">
            Total filtrado: {brl(totalFiltrado)}
          </p>

          {filtradas.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="font-semibold text-[var(--color-ink-600)]">
                Nenhum apontamento encontrado neste filtro.
              </p>
            </Card>
          ) : (
            <>
              <div className="space-y-3 lg:hidden">
                {visiveis.map((linha) => {
                  const total =
                    Number(linha.quantidade ?? 0) *
                    Number(linha.valor_unitario_snapshot ?? 0);
                  return (
                    <Card key={linha.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold text-[var(--color-ink-500)]">
                            {ddmmyyyy(linha.data)}
                          </p>
                          <h4 className="mt-1 font-bold text-[var(--color-ink-900)]">
                            {linha.atividades?.nome ?? "Atividade sem nome"}
                          </h4>
                        </div>
                        <p className="text-base font-bold text-[var(--color-gn-700)]">
                          {brl(total)}
                        </p>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <dt className="font-bold text-[var(--color-ink-500)]">Projeto</dt>
                          <dd className="font-semibold">{linha.projetos?.nome ?? "-"}</dd>
                        </div>
                        <div>
                          <dt className="font-bold text-[var(--color-ink-500)]">Talhão</dt>
                          <dd className="font-semibold">{linha.talhao ?? "-"}</dd>
                        </div>
                        <div>
                          <dt className="font-bold text-[var(--color-ink-500)]">Produção</dt>
                          <dd className="font-semibold">
                            {num(Number(linha.quantidade))} {linha.atividades?.unidade ?? "ha"}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-bold text-[var(--color-ink-500)]">Tarifa</dt>
                          <dd className="font-semibold">
                            {brl(Number(linha.valor_unitario_snapshot))}
                          </dd>
                        </div>
                      </dl>
                      {linha.observacoes && (
                        <p className="mt-3 text-xs font-semibold text-[var(--color-ink-600)]">
                          {linha.observacoes}
                        </p>
                      )}
                    </Card>
                  );
                })}
              </div>

              <Card className="hidden overflow-hidden lg:block">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-[var(--color-ink-50)] text-xs uppercase text-[var(--color-ink-600)]">
                      <tr>
                        <th className="px-4 py-3 font-bold">Data</th>
                        <th className="px-4 py-3 font-bold">Projeto</th>
                        <th className="px-4 py-3 font-bold">Atividade</th>
                        <th className="px-4 py-3 font-bold">Talhão</th>
                        <th className="px-4 py-3 text-right font-bold">Hectares</th>
                        <th className="px-4 py-3 text-right font-bold">Tarifa</th>
                        <th className="px-4 py-3 text-right font-bold">Faturamento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-ink-100)]">
                      {visiveis.map((linha) => {
                        const total =
                          Number(linha.quantidade ?? 0) *
                          Number(linha.valor_unitario_snapshot ?? 0);
                        return (
                          <tr key={linha.id} className="align-top">
                            <td className="px-4 py-3 font-semibold">
                              {ddmmyyyy(linha.data)}
                            </td>
                            <td className="px-4 py-3 font-semibold">
                              {linha.projetos?.nome ?? "-"}
                            </td>
                            <td className="px-4 py-3 font-semibold">
                              {linha.atividades?.nome ?? "Atividade sem nome"}
                              {linha.observacoes && (
                                <p className="mt-1 text-xs text-[var(--color-ink-500)]">
                                  {linha.observacoes}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 font-semibold">
                              {linha.talhao ?? "-"}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold tabular">
                              {num(Number(linha.quantidade))}{" "}
                              {linha.atividades?.unidade ?? "ha"}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold tabular">
                              {brl(Number(linha.valor_unitario_snapshot))}
                            </td>
                            <td className="px-4 py-3 text-right font-bold tabular">
                              {brl(total)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </section>
  );
}
