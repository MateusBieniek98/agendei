"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import type { ManutencaoIndicadores, MaintenancePriority } from "@/lib/types";

function priorityTone(priority: MaintenancePriority) {
  if (priority === "urgente") return "danger" as const;
  if (priority === "alta") return "warning" as const;
  return "neutral" as const;
}

function daysLabel(value: number) {
  return `${value} dia${value === 1 ? "" : "s"}`;
}

function Metric({ label, value, hint, color }: { label: string; value: string | number; hint: string; color?: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4">
      <p className="text-xs font-medium text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular text-[var(--text-primary)]" style={color ? { color } : undefined}>{value}</p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p>
    </div>
  );
}

export default function MaintenanceDashboard({
  initialData = null,
  preview = false,
}: {
  initialData?: ManutencaoIndicadores | null;
  preview?: boolean;
}) {
  const { toast } = useToast();
  const [data, setData] = useState<ManutencaoIndicadores | null>(initialData);
  const [loading, setLoading] = useState(!initialData);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/manutencoes/indicadores", { cache: "no-store" });
      const json = (await response.json().catch(() => ({}))) as { indicadores?: ManutencaoIndicadores; error?: string };
      if (!response.ok || !json.indicadores) throw new Error(json.error ?? response.statusText);
      setData(json.indicadores);
    } catch (error) {
      toast(`Erro ao carregar indicadores: ${(error as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (preview) return;
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(timer);
  }, [load, preview]);

  const totalFaixas = data
    ? data.faixas.ate_2_dias + data.faixas.de_3_a_7_dias + data.faixas.acima_7_dias
    : 0;

  return (
    <section className="space-y-5 pb-8">
      <PageHeader
        eyebrow="Manutenção"
        title="Dashboard"
        subtitle="Disponibilidade da frota e tempo de máquina parada"
        right={<Button variant="secondary" size="sm" loading={loading} disabled={preview} onClick={() => void load()}>Atualizar</Button>}
      />

      {!data ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-8 text-center text-sm text-[var(--text-muted)]">
          {loading ? "Carregando indicadores..." : "Indicadores indisponíveis."}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Máquinas paradas" value={data.maquinas_paradas} hint={`${data.aguardando} aguardando manutenção`} color="var(--danger)" />
            <Metric label="Em atendimento" value={data.em_atendimento} hint={`${data.aguardando} ainda não iniciada${data.aguardando === 1 ? "" : "s"}`} color="var(--warn)" />
            <Metric label="Tempo médio parado" value={`${data.tempo_medio_parado_dias.toLocaleString("pt-BR")} dias`} hint={`${data.resolvidos_30d} resolvido${data.resolvidos_30d === 1 ? "" : "s"} nos últimos 30 dias`} />
            <Metric label="Maior parada atual" value={daysLabel(data.maior_tempo_aberto_dias)} hint="Desde a abertura da solicitação" />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.7fr)]">
            <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)]">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">Máquinas paradas agora</h2>
                  <p className="text-xs text-[var(--text-muted)]">Ordenadas pelo maior tempo de parada</p>
                </div>
                <Link href="/manutencao/solicitacoes" className="text-xs font-medium text-[var(--accent)]">Abrir fila</Link>
              </div>
              {data.paradas.length === 0 ? (
                <div className="p-8 text-center text-sm text-[var(--text-muted)]">Nenhuma máquina parada.</div>
              ) : (
                <div className="divide-y divide-[var(--divider)]">
                  {data.paradas.slice(0, 8).map((item) => (
                    <Link key={item.id} href={`/manutencao/solicitacoes?chamado=${item.id}`} className="block p-4 transition-colors hover:bg-[var(--bg-hover)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={priorityTone(item.prioridade)}>{item.prioridade}</Badge>
                            <h3 className="truncate text-sm font-semibold text-[var(--text-primary)]">
                              {item.maquina_nome}{item.maquina_identificador ? ` · ${item.maquina_identificador}` : ""}
                            </h3>
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm text-[var(--text-secondary)]">{item.situacao_atual}</p>
                          <p className="mt-1 text-xs text-[var(--text-muted)]">{item.responsavel_nome ? `Responsável: ${item.responsavel_nome}` : "Sem responsável"}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-lg font-semibold tabular text-[var(--danger)]">{item.dias_parada}</p>
                          <p className="text-[11px] text-[var(--text-muted)]">dias parada</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Faixa de tempo parada</h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Chamados ainda não resolvidos</p>
              <div className="mt-5 space-y-4">
                {[
                  ["Até 2 dias", data.faixas.ate_2_dias, "var(--success)"],
                  ["De 3 a 7 dias", data.faixas.de_3_a_7_dias, "var(--warn)"],
                  ["Acima de 7 dias", data.faixas.acima_7_dias, "var(--danger)"],
                ].map(([label, value, color]) => {
                  const amount = Number(value);
                  const width = totalFaixas > 0 ? Math.max((amount / totalFaixas) * 100, amount ? 6 : 0) : 0;
                  return (
                    <div key={String(label)}>
                      <div className="flex justify-between text-xs"><span className="text-[var(--text-secondary)]">{label}</span><b className="tabular text-[var(--text-primary)]">{amount}</b></div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--bg-active)]"><div className="h-full rounded-full" style={{ width: `${width}%`, background: String(color) }} /></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
