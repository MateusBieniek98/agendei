"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import PageHeader from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { ddmmyyyy } from "@/lib/format";
import type { MachineStatus, Maquina, ManutencaoEvento, ManutencaoThread } from "@/lib/types";

const STATUS_OPTIONS: { value: MachineStatus; label: string }[] = [
  { value: "operando", label: "Operando" },
  { value: "parada", label: "Parada" },
  { value: "manutencao_urgente", label: "Manutenção urgente" },
];

function statusMeta(status: MachineStatus) {
  if (status === "operando") return { label: "Operando", tone: "success" as const };
  if (status === "parada") return { label: "Parada", tone: "warning" as const };
  return { label: "Urgente", tone: "danger" as const };
}

const EVENT_LABEL: Record<ManutencaoEvento["tipo"], string> = {
  criado: "Solicitação criada",
  atribuido: "Responsável definido",
  iniciado: "Serviço iniciado",
  prioridade_alterada: "Prioridade alterada",
  concluido: "Serviço concluído",
  status_maquina_alterado: "Status da máquina alterado",
};

async function getJson<T>(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  const json = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok || json.error) throw new Error(json.error ?? response.statusText);
  return json;
}

export default function MaintenanceMachines() {
  const { toast } = useToast();
  const [machines, setMachines] = useState<Maquina[]>([]);
  const [threads, setThreads] = useState<ManutencaoThread[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [events, setEvents] = useState<ManutencaoEvento[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [machineData, threadData] = await Promise.all([
        getJson<{ items: Maquina[] }>("/api/maquinas"),
        getJson<{ items: ManutencaoThread[] }>("/api/manutencoes"),
      ]);
      setMachines((machineData.items ?? []).filter((item) => item.ativo));
      setThreads(threadData.items ?? []);
    } catch (error) {
      toast(`Erro ao carregar máquinas: ${(error as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(timer);
  }, [load]);

  const selected = machines.find((item) => item.id === selectedId) ?? null;
  const selectedThreads = threads.filter((item) => item.maquina_id === selectedId);
  const pendingThreads = selectedThreads.filter((item) => item.status !== "resolvido");
  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return machines;
    return machines.filter((item) =>
      [item.nome, item.tipo, item.identificador].some((value) => value?.toLowerCase().includes(normalized))
    );
  }, [machines, query]);

  async function updateStatus(machine: Maquina, status: MachineStatus) {
    setSaving(true);
    try {
      const response = await fetch(`/api/maquinas/${machine.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok || json.error) throw new Error(json.error ?? response.statusText);
      toast("Status da máquina atualizado.", "success");
      await load();
      await loadMachineHistory(machine.id);
    } catch (error) {
      toast(`Erro: ${(error as Error).message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  async function loadMachineHistory(machineId: string) {
    try {
      const data = await getJson<{ events: ManutencaoEvento[] }>(`/api/maquinas/${machineId}`);
      setEvents(data.events ?? []);
    } catch (error) {
      toast(`Erro ao carregar histórico: ${(error as Error).message}`, "error");
    }
  }

  function openMachine(machineId: string) {
    setSelectedId(machineId);
    setEvents([]);
    void loadMachineHistory(machineId);
  }

  const counts = {
    operando: machines.filter((item) => item.status === "operando").length,
    parada: machines.filter((item) => item.status === "parada").length,
    urgente: machines.filter((item) => item.status === "manutencao_urgente").length,
  };

  return (
    <section className="space-y-5 pb-8">
      <PageHeader eyebrow="Manutenção" title="Máquinas" subtitle={`${machines.length} máquinas ativas`} right={<Button variant="secondary" size="sm" loading={loading} onClick={() => void load()}>Atualizar</Button>} />

      <div className="grid grid-cols-3 gap-2">
        {[
          ["Operando", counts.operando, "var(--success)"],
          ["Paradas", counts.parada, "var(--warn)"],
          ["Urgentes", counts.urgente, "var(--danger)"],
        ].map(([label, value, color]) => <div key={String(label)} className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3"><p className="text-xl font-semibold tabular" style={{ color: String(color) }}>{value}</p><p className="truncate text-[11px] font-medium text-[var(--text-muted)]">{label}</p></div>)}
      </div>

      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar máquina, tipo ou identificação" className="h-11 w-full rounded-md border border-[var(--border)] bg-[var(--bg-input)] px-3 text-sm font-normal text-[var(--text-primary)]" />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((machine) => {
          const meta = statusMeta(machine.status);
          const open = threads.filter((item) => item.maquina_id === machine.id && item.status !== "resolvido").length;
          return <button key={machine.id} type="button" onClick={() => openMachine(machine.id)} className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4 text-left transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><Badge tone={meta.tone}>{meta.label}</Badge><h2 className="mt-2 truncate text-base font-semibold text-[var(--text-primary)]">{machine.nome}</h2><p className="truncate text-xs font-normal text-[var(--text-muted)]">{machine.tipo}{machine.identificador ? ` · ${machine.identificador}` : ""}</p>{open > 0 && <p className="mt-2 text-xs font-medium text-[var(--danger)]">{open} solicitação{open === 1 ? "" : "ões"} pendente{open === 1 ? "" : "s"}</p>}</div><span className="text-xl text-[var(--text-muted)]">›</span></div></button>;
        })}
      </div>

      {!loading && visible.length === 0 && <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-sm font-semibold text-[var(--text-muted)]">Nenhuma máquina encontrada.</div>}

      {selected && <div className="fixed inset-0 z-[70] bg-black/35" onClick={() => setSelectedId(null)}><aside className="ml-auto h-full w-full overflow-y-auto bg-[var(--bg-page)] shadow-2xl sm:max-w-xl" onClick={(event) => event.stopPropagation()}><div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-card)] px-4 py-3"><div className="min-w-0"><p className="text-xs font-bold uppercase text-[var(--text-muted)]">Máquina</p><h2 className="truncate text-lg font-bold text-[var(--text-primary)]">{selected.nome}</h2></div><Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>Fechar</Button></div><div className="space-y-4 p-4 sm:p-5"><div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4"><p className="text-sm font-semibold text-[var(--text-secondary)]">{selected.tipo}{selected.identificador ? ` · ${selected.identificador}` : ""}</p><div className="mt-4"><Select label="Status operacional" value={selected.status} disabled={saving} onChange={(event) => void updateStatus(selected, event.target.value as MachineStatus)} options={STATUS_OPTIONS} /></div></div><div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4"><h3 className="text-sm font-bold text-[var(--text-primary)]">Chamados pendentes</h3>{pendingThreads.length === 0 ? <p className="mt-3 text-sm font-semibold text-[var(--text-muted)]">Nenhum chamado pendente.</p> : <div className="mt-3 space-y-3">{pendingThreads.map((thread) => <div key={thread.id} className="border-l-2 border-[var(--border)] pl-3"><div className="flex flex-wrap gap-1"><Badge tone="warning">Pendente</Badge><Badge tone={thread.prioridade === "urgente" ? "danger" : thread.prioridade === "alta" ? "warning" : "neutral"}>{thread.prioridade}</Badge></div><p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{thread.descricao}</p><p className="mt-1 text-[11px] text-[var(--text-muted)]">{ddmmyyyy(thread.created_at)}{thread.responsavel ? ` · ${thread.responsavel.nome}` : ""}</p></div>)}</div>}</div><div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4"><h3 className="text-sm font-bold text-[var(--text-primary)]">Histórico</h3>{events.length === 0 ? <p className="mt-3 text-sm font-semibold text-[var(--text-muted)]">O histórico começa nas próximas alterações.</p> : <div className="mt-3 space-y-3">{events.map((event) => <div key={event.id} className="border-l-2 border-[var(--border)] pl-3"><p className="text-sm font-bold text-[var(--text-primary)]">{EVENT_LABEL[event.tipo]}</p><p className="mt-1 text-[11px] text-[var(--text-muted)]">{ddmmyyyy(event.created_at)}{event.ator?.nome ? ` · ${event.ator.nome}` : ""}</p></div>)}</div>}</div></div></aside></div>}
    </section>
  );
}
