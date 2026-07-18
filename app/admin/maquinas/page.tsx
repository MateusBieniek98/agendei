"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import MaintenanceFeed from "@/components/maintenance/MaintenanceFeed";
import PageHeader from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { ddmmyyyy } from "@/lib/format";
import type { Equipe, Maquina, MachineStatus, MaintenanceStatus, Manutencao, Projeto } from "@/lib/types";

type ManutComMaquina = Manutencao & {
  maquinas: { nome: string; tipo: string; identificador: string | null; status: MachineStatus } | null;
  equipes: { nome: string } | null;
  projetos: { nome: string } | null;
};

const STATUS_OPTS: { value: MachineStatus; label: string }[] = [
  { value: "operando",          label: "Operando" },
  { value: "parada",            label: "Parada" },
  { value: "manutencao_urgente", label: "Manutenção urgente" },
];

const STATUS_META: Record<MachineStatus, { dot: string; bg: string; border: string; label: string }> = {
  operando: {
    dot:   "var(--success)",
    bg:    "var(--success-bg, #f0fdf4)",
    border:"var(--success)",
    label: "Operando",
  },
  parada: {
    dot:   "var(--warn)",
    bg:    "var(--warn-bg)",
    border:"var(--warn)",
    label: "Parada",
  },
  manutencao_urgente: {
    dot:   "var(--danger)",
    bg:    "var(--danger-bg)",
    border:"var(--danger)",
    label: "Manutenção urgente",
  },
};

const MANUT_STATUS_META: Record<MaintenanceStatus, { label: string; color: string; bg: string; border: string }> = {
  aberto: {
    label: "Aberto",
    color: "var(--danger)",
    bg: "var(--danger-bg)",
    border: "var(--danger)",
  },
  em_andamento: {
    label: "Em andamento",
    color: "var(--warn)",
    bg: "var(--warn-bg)",
    border: "var(--warn)",
  },
  resolvido: {
    label: "Resolvido",
    color: "var(--success)",
    bg: "var(--success-bg)",
    border: "var(--success)",
  },
};

const KANBAN_ACTIVE_STATUSES: MaintenanceStatus[] = ["aberto", "em_andamento"];
const KANBAN_ALL_STATUSES: MaintenanceStatus[] = ["aberto", "em_andamento", "resolvido"];

function StatusDot({ status, pulse = false }: { status: MachineStatus; pulse?: boolean }) {
  const color = STATUS_META[status]?.dot ?? "var(--text-muted)";
  return (
    <span
      className={pulse ? "relative flex h-3 w-3" : ""}
      style={{ display: "inline-block" }}
    >
      {pulse ? (
        <>
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
            style={{ background: color }}
          />
          <span
            className="relative inline-flex rounded-full h-3 w-3"
            style={{ background: color }}
          />
        </>
      ) : (
        <span
          className="inline-block rounded-full"
          style={{ width: 10, height: 10, background: color, flexShrink: 0 }}
        />
      )}
    </span>
  );
}

function ManutencaoCard({
  manut,
  onStatusChange,
}: {
  manut: ManutComMaquina;
  onStatusChange: (manut: ManutComMaquina, status: MaintenanceStatus) => void;
}) {
  const meta = MANUT_STATUS_META[manut.status];
  const contexto = [
    manut.equipes?.nome,
    manut.projetos?.nome,
    manut.talhao ? `Talhão ${manut.talhao}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <article
      className="rounded-xl p-3"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            {manut.maquinas?.nome ?? "Máquina removida"}
          </p>
          <p className="truncate text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
            {manut.maquinas?.tipo ?? "Frota"}
            {manut.maquinas?.identificador ? ` · ${manut.maquinas.identificador}` : ""}
          </p>
        </div>
        <span
          className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold"
          style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}
        >
          {meta.label}
        </span>
      </div>

      {contexto && (
        <p className="mt-2 truncate text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
          {contexto}
        </p>
      )}

      <p className="mt-2 text-xs font-semibold leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {manut.descricao}
      </p>
      <p className="mt-2 text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
        Aberto em {ddmmyyyy(manut.created_at)}
        {manut.resolvido_em ? ` · Resolvido em ${ddmmyyyy(manut.resolvido_em)}` : ""}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {manut.status === "aberto" && (
          <>
            <button
              type="button"
              onClick={() => onStatusChange(manut, "em_andamento")}
              className="min-h-10 rounded-lg border px-3 text-xs font-bold"
              style={{ background: "var(--warn-bg)", borderColor: "var(--warn)", color: "var(--warn)" }}
            >
              Iniciar
            </button>
            <button
              type="button"
              onClick={() => onStatusChange(manut, "resolvido")}
              className="min-h-10 rounded-lg border px-3 text-xs font-bold"
              style={{ background: "var(--success-bg)", borderColor: "var(--success)", color: "var(--success)" }}
            >
              Resolver
            </button>
          </>
        )}

        {manut.status === "em_andamento" && (
          <>
            <button
              type="button"
              onClick={() => onStatusChange(manut, "aberto")}
              className="min-h-10 rounded-lg border px-3 text-xs font-bold"
              style={{ background: "var(--bg-page)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={() => onStatusChange(manut, "resolvido")}
              className="min-h-10 rounded-lg border px-3 text-xs font-bold"
              style={{ background: "var(--success-bg)", borderColor: "var(--success)", color: "var(--success)" }}
            >
              Resolver
            </button>
          </>
        )}

        {manut.status === "resolvido" && (
          <button
            type="button"
            onClick={() => onStatusChange(manut, "aberto")}
            className="col-span-2 min-h-10 rounded-lg border px-3 text-xs font-bold"
            style={{ background: "var(--danger-bg)", borderColor: "var(--danger)", color: "var(--danger)" }}
          >
            Reabrir OS
          </button>
        )}
      </div>
    </article>
  );
}

function KanbanColumn({
  status,
  items,
  onStatusChange,
}: {
  status: MaintenanceStatus;
  items: ManutComMaquina[];
  onStatusChange: (manut: ManutComMaquina, status: MaintenanceStatus) => void;
}) {
  const meta = MANUT_STATUS_META[status];

  return (
    <section
      className="flex min-h-[16rem] flex-col rounded-lg"
      style={{ background: "var(--bg-page)", border: "1px solid var(--border)" }}
    >
      <div
        className="flex items-center justify-between gap-2 border-b px-3 py-3"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.color }} />
          <h4 className="truncate text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            {meta.label}
          </h4>
        </div>
        <span
          className="rounded-md px-2 py-0.5 text-[11px] font-bold"
          style={{ background: meta.bg, color: meta.color }}
        >
          {items.length}
        </span>
      </div>

      <div className="flex-1 space-y-2 p-2">
        {items.length === 0 ? (
          <div
            className="grid min-h-28 place-items-center rounded-lg border border-dashed p-3 text-center text-xs font-semibold"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            Nenhuma OS nesta etapa.
          </div>
        ) : (
          items.map((manut) => (
            <ManutencaoCard key={manut.id} manut={manut} onStatusChange={onStatusChange} />
          ))
        )}
      </div>
    </section>
  );
}

function ManutencaoKanban({
  items,
  showResolved,
  onStatusChange,
}: {
  items: ManutComMaquina[];
  showResolved: boolean;
  onStatusChange: (manut: ManutComMaquina, status: MaintenanceStatus) => void;
}) {
  const statuses = showResolved ? KANBAN_ALL_STATUSES : KANBAN_ACTIVE_STATUSES;

  return (
    <div className={`grid grid-cols-1 gap-3 ${showResolved ? "xl:grid-cols-3" : "lg:grid-cols-2"}`}>
      {statuses.map((status) => (
        <KanbanColumn
          key={status}
          status={status}
          items={items.filter((manut) => manut.status === status)}
          onStatusChange={onStatusChange}
        />
      ))}
    </div>
  );
}

function MaquinaCard({
  maquina,
  manutAbertas,
  onEdit,
  onStatusChange,
}: {
  maquina: Maquina;
  manutAbertas: number;
  onEdit: () => void;
  onStatusChange: (s: MachineStatus) => void;
}) {
  const meta = STATUS_META[maquina.status] ?? STATUS_META.parada;
  const isUrgente = maquina.status === "manutencao_urgente";

  return (
    <div
      className="rounded-lg p-3 flex flex-col gap-3 animate-fade-in"
      style={{
        background: "var(--bg-card)",
        border: `1.5px solid ${isUrgente ? meta.border : "var(--border)"}`,
        boxShadow: isUrgente ? `0 0 0 3px ${meta.bg}` : "var(--shadow-card, 0 1px 4px rgba(0,0,0,.07))",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isUrgente ? (
            <StatusDot status={maquina.status} pulse />
          ) : (
            <StatusDot status={maquina.status} />
          )}
          <div className="min-w-0">
            <p className="font-bold text-sm leading-tight truncate" style={{ color: "var(--text-primary)" }}>
              {maquina.nome}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {maquina.tipo}{maquina.identificador ? ` · ${maquina.identificador}` : ""}
            </p>
          </div>
        </div>
        {manutAbertas > 0 && (
          <span
            className="shrink-0 rounded-md px-2 py-0.5 text-xs font-bold"
            style={{ background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid var(--danger)" }}
          >
            {manutAbertas} OS
          </span>
        )}
      </div>

      {/* Status badge pill */}
      <div
        className="flex items-center gap-1.5 self-start rounded-md px-2.5 py-1 text-xs font-semibold"
        style={{ background: meta.bg, color: meta.border, border: `1px solid ${meta.border}` }}
      >
        {meta.label}
      </div>

      {/* Status change */}
      <select
        value={maquina.status}
        onChange={(e) => onStatusChange(e.target.value as MachineStatus)}
        className="h-9 w-full rounded-lg border px-3 text-xs font-semibold"
        style={{
          background: "var(--bg-input, var(--bg-card))",
          color: "var(--text-primary)",
          borderColor: "var(--border)",
        }}
      >
        {STATUS_OPTS.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      {/* Footer */}
      <button
        onClick={onEdit}
        className="text-xs font-semibold text-right"
        style={{ color: "var(--accent)" }}
      >
        Editar →
      </button>
    </div>
  );
}

const FILTER_KEY = "gn:maquinas-filtro";

export default function MaquinasAdminPage() {
  const { toast } = useToast();
  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [manuts, setManuts] = useState<ManutComMaquina[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [editing, setEditing] = useState<Partial<Maquina> | null>(null);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(FILTER_KEY) ?? "";
    }
    return "";
  });
  const [tabManut, setTabManut] = useState<"abertas" | "todas">("abertas");
  const [manutView, setManutView] = useState<"feed" | "kanban">("feed");

  const carregar = useCallback(async () => {
    try {
      const [mr, mn, er, pr] = await Promise.all([
        fetch("/api/maquinas").then((r) => r.json()),
        fetch("/api/manutencoes").then((r) => r.json()),
        fetch("/api/equipes").then((r) => r.json()),
        fetch("/api/projetos").then((r) => r.json()),
      ]);
      setMaquinas(Array.isArray(mr.items) ? (mr.items as Maquina[]) : []);
      setManuts(Array.isArray(mn.items) ? (mn.items as ManutComMaquina[]) : []);
      setEquipes(Array.isArray(er.items) ? (er.items as Equipe[]) : []);
      setProjetos(Array.isArray(pr.items) ? (pr.items as Projeto[]) : []);
    } catch (err) {
      toast(`Erro ao carregar: ${(err as Error).message}`, "error");
    }
  }, [toast]);

  useEffect(() => { void carregar(); }, [carregar]);

  // Persist filter
  function setFiltro(v: string) {
    setStatusFiltro(v);
    localStorage.setItem(FILTER_KEY, v);
  }

  async function salvar() {
    if (!editing?.nome || !editing.tipo) {
      toast("Preencha nome e tipo.", "error"); return;
    }
    const url    = editing.id ? `/api/maquinas/${editing.id}` : "/api/maquinas";
    const method = editing.id ? "PATCH" : "POST";
    const r = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nome: editing.nome, tipo: editing.tipo,
        identificador: editing.identificador ?? null,
        status: editing.status ?? "operando",
        ativo: editing.ativo ?? true,
      }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast(`Erro: ${j.error ?? r.statusText}`, "error"); return;
    }
    toast("Máquina salva.", "success");
    setEditing(null);
    void carregar();
  }

  async function alterarStatus(id: string, status: MachineStatus) {
    const r = await fetch(`/api/maquinas/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!r.ok) toast("Erro ao alterar status.", "error");
    else void carregar();
  }

  async function resolverManut(id: string) {
    const r = await fetch(`/api/manutencoes/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "resolvido" }),
    });
    if (!r.ok) toast("Erro.", "error");
    else { toast("Marcada como resolvida.", "success"); void carregar(); }
  }

  async function alterarStatusManut(manut: ManutComMaquina, status: MaintenanceStatus) {
    if (status === "resolvido") {
      await resolverManut(manut.id);
      return;
    }

    const r = await fetch(`/api/manutencoes/${manut.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, resolvido_em: null }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast(`Erro: ${j.error ?? r.statusText}`, "error");
      return;
    }
    toast(`OS movida para ${MANUT_STATUS_META[status].label}.`, "success");
    void carregar();
  }

  // Filter + search
  const maquinasFiltradas = maquinas.filter((m) => {
    if (statusFiltro && m.status !== statusFiltro) return false;
    if (!busca) return true;
    const q = busca.toLowerCase();
    return (
      m.nome.toLowerCase().includes(q) ||
      m.tipo.toLowerCase().includes(q) ||
      (m.identificador ?? "").toLowerCase().includes(q)
    );
  });

  // Build open manut counts per machine
  const manutAbertasPorMaquina: Record<string, number> = {};
  manuts.forEach((mn) => {
    if (mn.status !== "resolvido") {
      manutAbertasPorMaquina[mn.maquina_id] = (manutAbertasPorMaquina[mn.maquina_id] ?? 0) + 1;
    }
  });

  const manutsKanban = manuts.filter((m) =>
    tabManut === "abertas" ? m.status !== "resolvido" : true
  );

  // Summary counts
  const nOperando  = maquinas.filter((m) => m.status === "operando").length;
  const nParada    = maquinas.filter((m) => m.status === "parada").length;
  const nUrgente   = maquinas.filter((m) => m.status === "manutencao_urgente").length;
  const nOSAbertas = manuts.filter((m) => m.status !== "resolvido").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        eyebrow="Frota"
        title="Máquinas"
        subtitle="Gerencie a frota e acompanhe manutenções abertas."
        right={
          <Button
            className="w-full sm:w-auto"
            onClick={() => setEditing({ nome: "", tipo: "Trator", status: "operando" })}
          >
            + Nova máquina
          </Button>
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Operando",  value: nOperando,  color: "var(--success)" },
          { label: "Paradas",   value: nParada,    color: "var(--warn)" },
          { label: "Urgentes",  value: nUrgente,   color: "var(--danger)" },
          { label: "OS abertas",value: nOSAbertas, color: "var(--accent)" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg p-3 text-center"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          className="h-9 min-w-[160px] flex-1 rounded-lg border px-3 text-sm"
          style={{
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            borderColor: "var(--border)",
          }}
          placeholder="Pesquisar por nome, tipo ou código..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <div className="flex gap-1">
          {[{ v: "", label: "Todas" }, ...STATUS_OPTS.map((s) => ({ v: s.value, label: s.label }))].map((f) => (
            <button
              key={f.v}
              onClick={() => setFiltro(f.v)}
              className="h-9 rounded-lg border px-3 text-xs font-semibold transition-all"
              style={{
                background: statusFiltro === f.v ? "var(--accent)" : "var(--bg-card)",
                color: statusFiltro === f.v ? "#fff" : "var(--text-secondary)",
                borderColor: statusFiltro === f.v ? "var(--accent)" : "var(--border)",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de máquinas */}
      {maquinasFiltradas.length === 0 ? (
        <div
          className="rounded-lg p-8 text-center text-sm"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
        >
          Nenhuma máquina encontrada.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {maquinasFiltradas.map((m) => (
            <MaquinaCard
              key={m.id}
              maquina={m}
              manutAbertas={manutAbertasPorMaquina[m.id] ?? 0}
              onEdit={() => setEditing(m)}
              onStatusChange={(s) => alterarStatus(m.id, s)}
            />
          ))}
        </div>
      )}

      {/* Manutenções */}
      <div
        className="rounded-lg p-3 sm:p-4"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <div
          className="flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="min-w-0">
            <h3 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>
              Manutenções
            </h3>
            <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              Fila simples com detalhes e ações sob demanda
            </p>
          </div>
          <div className="hidden">
            <div className="grid grid-cols-2 rounded-lg p-1 sm:w-fit" style={{ background: "var(--bg-page)", border: "1px solid var(--border)" }}>
              {(["feed", "kanban"] as const).map((view) => (
                <button
                  type="button"
                  key={view}
                  onClick={() => setManutView(view)}
                  className="min-h-10 rounded-lg px-4 text-xs font-bold transition"
                  style={{
                    background: manutView === view ? "var(--accent)" : "transparent",
                    color: manutView === view ? "#fff" : "var(--text-muted)",
                  }}
                >
                  {view === "feed" ? "Feed" : "Kanban"}
                </button>
              ))}
            </div>
            {manutView === "kanban" && (
              <div className="grid grid-cols-2 rounded-lg p-1 sm:w-fit" style={{ background: "var(--bg-page)", border: "1px solid var(--border)" }}>
                {(["abertas", "todas"] as const).map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setTabManut(t)}
                className="min-h-10 rounded-lg px-4 text-xs font-bold transition"
                style={{
                  background: tabManut === t ? "var(--accent)" : "transparent",
                  color: tabManut === t ? "#fff" : "var(--text-muted)",
                }}
              >
                {t === "abertas" ? `Ativas (${nOSAbertas})` : "Todas"}
              </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {manutView === "feed" ? (
          <div className="mt-3">
            <MaintenanceFeed
              mode="admin"
              maquinas={maquinas}
              equipes={equipes}
              projetos={projetos}
              compact
              onChanged={carregar}
            />
          </div>
        ) : manutsKanban.length === 0 ? (
          <div className="p-8 text-center text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
            {tabManut === "abertas" ? "Nenhuma OS ativa." : "Sem manutenções registradas."}
          </div>
        ) : (
          <div className="mt-3">
            <ManutencaoKanban
              items={manutsKanban}
              showResolved={tabManut === "todas"}
              onStatusChange={alterarStatusManut}
            />
          </div>
        )}
      </div>

      {/* Modal editar/criar */}
      {editing && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 z-50"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-md rounded-lg p-5 space-y-3"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              {editing.id ? "Editar" : "Nova"} máquina
            </h3>
            <Input label="Nome" value={editing.nome ?? ""}
                   onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
            <Input label="Tipo" hint="ex: Trator, Roçadeira, Pulverizador"
                   value={editing.tipo ?? ""}
                   onChange={(e) => setEditing({ ...editing, tipo: e.target.value })} />
            <Input label="Identificador / patrimônio"
                   value={editing.identificador ?? ""}
                   onChange={(e) => setEditing({ ...editing, identificador: e.target.value })} />
            <Select
              label="Status"
              value={editing.status ?? "operando"}
              onChange={(e) => setEditing({ ...editing, status: e.target.value as MachineStatus })}
              options={STATUS_OPTS}
            />
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button onClick={salvar}>Salvar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
