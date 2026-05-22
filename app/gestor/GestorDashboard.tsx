"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import AdminDashboard from "@/app/admin/AdminDashboard";
import { ddmmyyyy } from "@/lib/format";
import PlanejamentoField from "@/app/(field)/planejamento/PlanejamentoField";
import type { MachineStatus } from "@/lib/types";

export type GestorDashboardAba = "faturamento" | "manutencao" | "planejamento";
type Aba = GestorDashboardAba;

type Manut = {
  id: string;
  maquina_id: string;
  descricao: string;
  status: "aberto" | "em_andamento" | "resolvido";
  created_at: string;
  resolvido_em: string | null;
  talhao: string | null;
  maquinas: {
    nome: string;
    tipo: string;
    identificador: string | null;
    status: MachineStatus;
  } | null;
  equipes: { nome: string } | null;
  projetos: { nome: string } | null;
};

type DashboardData = {
  maquinas: { operando: number; paradas: number; urgentes: number; total: number };
  manutencoesAbertas: Manut[];
};

const ABAS: { value: Aba; label: string }[] = [
  { value: "faturamento",  label: "Faturamento"  },
  { value: "manutencao",   label: "Manutenção"   },
  { value: "planejamento", label: "Planejamento" },
];

type GestorDashboardProps = {
  initialAba?: Aba;
  mostrarManutencao?: boolean;
  mostrarPlanejamento?: boolean;
};

const STATUS_OPTS: { value: MachineStatus; label: string }[] = [
  { value: "operando",           label: "Operando"           },
  { value: "parada",             label: "Parada"             },
  { value: "manutencao_urgente", label: "Manutenção urgente" },
];

function statusManut(status: Manut["status"]) {
  if (status === "aberto")       return <Badge tone="danger">aberto</Badge>;
  if (status === "em_andamento") return <Badge tone="warning">em andamento</Badge>;
  return <Badge tone="neutral">resolvido</Badge>;
}

function normalizarAba(
  aba: Aba,
  mostrarManutencao: boolean,
  mostrarPlanejamento: boolean,
): Aba {
  if (aba === "manutencao" && !mostrarManutencao) return "faturamento";
  if (aba === "planejamento" && !mostrarPlanejamento) return "faturamento";
  return aba;
}

export default function GestorDashboard({
  initialAba = "faturamento",
  mostrarManutencao = true,
  mostrarPlanejamento = true,
}: GestorDashboardProps) {
  const [aba,     setAba]     = useState<Aba>(() =>
    normalizarAba(initialAba, mostrarManutencao, mostrarPlanejamento),
  );
  const [data,    setData]    = useState<DashboardData | null>(null);
  const [erro,    setErro]    = useState<string | null>(null);

  async function carregar() {
    setErro(null);
    try {
      const r = await fetch("/api/dashboard?preset=ciclo_atual");
      const j = (await r.json()) as DashboardData & { error?: string };
      if (!r.ok || j.error) throw new Error(j.error ?? r.statusText);
      if (!j.maquinas || !Array.isArray(j.manutencoesAbertas)) {
        throw new Error("resposta inválida do dashboard");
      }
      setData(j);
    } catch (err) {
      setData(null);
      setErro((err as Error).message);
    }
  }

  async function alterarStatusMaquina(id: string, status: MachineStatus) {
    const r = await fetch(`/api/maquinas/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErro(`Erro ao alterar status da máquina: ${j.error ?? r.statusText}`);
      return;
    }
    await carregar();
  }

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    setAba(normalizarAba(initialAba, mostrarManutencao, mostrarPlanejamento));
  }, [initialAba, mostrarManutencao, mostrarPlanejamento]);

  if (!data && aba !== "planejamento") {
    return (
      <div className="space-y-6">
        <div className="text-sm font-semibold text-[var(--color-ink-600)]">
          {erro ? `Erro ao carregar dashboard: ${erro}` : "Carregando…"}
        </div>
      </div>
    );
  }

  const abasVisiveis = ABAS.filter((a) => {
    if (!mostrarManutencao && a.value === "manutencao") return false;
    if (!mostrarPlanejamento && a.value === "planejamento") return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Tab selector */}
      {abasVisiveis.length > 1 && (
        <div
          className={`grid gap-2 rounded-xl bg-[var(--color-ink-100)] p-1 ${
            abasVisiveis.length === 2 ? "grid-cols-2" : "grid-cols-3"
          }`}
        >
          {abasVisiveis.map((a) => (
            <button
              key={a.value}
              onClick={() => setAba(a.value)}
              className={
                "h-11 rounded-lg text-sm font-bold transition " +
                (aba === a.value
                  ? "bg-white text-[var(--color-gn-700)] shadow-sm"
                  : "text-[var(--color-ink-700)]")
              }
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      {erro && aba !== "planejamento" && (
        <Card className="p-3 text-sm font-bold text-[var(--color-danger-500)]">
          {erro}
        </Card>
      )}

      {/* ── Faturamento ── */}
      {aba === "faturamento" && (
        <AdminDashboard
          mode={mostrarManutencao || mostrarPlanejamento ? "gestor" : "encarregado"}
          showExports={false}
          title={mostrarManutencao || mostrarPlanejamento ? "Dashboard executivo" : "Resultados"}
          subtitle={
            mostrarManutencao || mostrarPlanejamento
              ? "Visão consolidada da operação."
              : "Resumo consolidado da produção apontada."
          }
        />
      )}

      {/* ── Manutenção ── */}
      {mostrarManutencao && aba === "manutencao" && data && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <Card className="p-3">
              <p className="text-3xl font-bold text-[var(--color-danger-500)] tabular">
                {data.manutencoesAbertas.length}
              </p>
              <p className="text-xs font-bold text-[var(--color-danger-500)] uppercase">
                pendentes
              </p>
            </Card>
            <Card className="p-3">
              <p className="text-3xl font-bold text-amber-700 tabular">
                {data.maquinas.paradas}
              </p>
              <p className="text-xs font-bold text-amber-700 uppercase">paradas</p>
            </Card>
            <Card className="p-3">
              <p className="text-3xl font-bold text-[var(--color-danger-500)] tabular">
                {data.maquinas.urgentes}
              </p>
              <p className="text-xs font-bold text-[var(--color-danger-500)] uppercase">
                urgentes
              </p>
            </Card>
          </div>

          <Card className="p-5">
            <div className="flex items-baseline justify-between">
              <h3 className="font-bold">Manutenções abertas</h3>
              <span className="text-xs font-bold text-[var(--color-ink-600)]">
                {data.manutencoesAbertas.length} pendentes
              </span>
            </div>

            {data.manutencoesAbertas.length === 0 ? (
              <p className="mt-4 text-sm font-semibold text-[var(--color-ink-600)]">
                Frota toda em ordem.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {data.manutencoesAbertas.map((m) => (
                  <li key={m.id} className="border border-[var(--color-ink-200)] rounded-xl p-4 bg-[var(--color-ink-50)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-[var(--color-ink-900)]">
                          {m.maquinas?.nome ?? "Máquina removida"}
                          {m.maquinas?.identificador ? ` · ${m.maquinas.identificador}` : ""}
                        </p>
                        {m.maquinas?.tipo && (
                          <p className="text-xs font-semibold text-[var(--color-ink-600)]">
                            {m.maquinas.tipo}
                          </p>
                        )}
                        <p className="mt-1 text-xs font-bold text-[var(--color-ink-700)]">
                          Frente: {m.equipes?.nome ?? "não informada"}
                        </p>
                        <p className="text-xs font-bold text-[var(--color-ink-700)]">
                          Projeto: {m.projetos?.nome ?? "não informado"}
                          {m.talhao ? ` · Talhão ${m.talhao}` : ""}
                        </p>
                      </div>
                      {statusManut(m.status)}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[var(--color-ink-800)]">
                      {m.descricao}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-[var(--color-ink-600)]">
                      Aberto em {ddmmyyyy(m.created_at)}
                    </p>
                    {m.maquinas && (
                      <div className="mt-3">
                        <label className="text-xs font-bold uppercase text-[var(--color-ink-600)]">
                          Status da máquina
                        </label>
                        <select
                          value={m.maquinas.status}
                          onChange={(e) =>
                            alterarStatusMaquina(m.maquina_id, e.target.value as MachineStatus)
                          }
                          className="mt-1 h-11 w-full rounded-lg border-2 border-[var(--color-ink-300)] bg-white px-3 text-sm font-bold text-[var(--color-ink-900)] shadow-sm outline-none focus:border-[var(--color-gn-500)] md:max-w-xs"
                        >
                          {STATUS_OPTS.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {/* ── Planejamento — mesmo componente do encarregado, sem filtro de equipe ── */}
      {mostrarPlanejamento && aba === "planejamento" && (
        <PlanejamentoField equipeId={null} />
      )}
    </div>
  );
}
