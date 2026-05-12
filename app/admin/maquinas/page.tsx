"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { ddmmyyyy } from "@/lib/format";
import type { Maquina, MachineStatus, Manutencao } from "@/lib/types";

type ManutComMaquina = Manutencao & {
  maquinas: { nome: string; identificador: string | null } | null;
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
      className="rounded-2xl p-4 flex flex-col gap-3 animate-fade-in"
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
            className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid var(--danger)" }}
          >
            {manutAbertas} OS
          </span>
        )}
      </div>

      {/* Status badge pill */}
      <div
        className="flex items-center gap-1.5 self-start px-2.5 py-1 rounded-full text-xs font-semibold"
        style={{ background: meta.bg, color: meta.border, border: `1px solid ${meta.border}` }}
      >
        {meta.label}
      </div>

      {/* Status change */}
      <select
        value={maquina.status}
        onChange={(e) => onStatusChange(e.target.value as MachineStatus)}
        className="w-full h-9 rounded-xl border px-3 text-xs font-semibold"
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
  const [editing, setEditing] = useState<Partial<Maquina> | null>(null);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(FILTER_KEY) ?? "";
    }
    return "";
  });
  const [tabManut, setTabManut] = useState<"abertas" | "todas">("abertas");

  async function carregar() {
    try {
      const [mr, mn] = await Promise.all([
        fetch("/api/maquinas").then((r) => r.json()),
        fetch("/api/manutencoes").then((r) => r.json()),
      ]);
      setMaquinas(Array.isArray(mr.items) ? (mr.items as Maquina[]) : []);
      setManuts(Array.isArray(mn.items) ? (mn.items as ManutComMaquina[]) : []);
    } catch (err) {
      toast(`Erro ao carregar: ${(err as Error).message}`, "error");
    }
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

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
    carregar();
  }

  async function alterarStatus(id: string, status: MachineStatus) {
    const r = await fetch(`/api/maquinas/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!r.ok) toast("Erro ao alterar status.", "error");
    else carregar();
  }

  async function resolverManut(id: string) {
    const r = await fetch(`/api/manutencoes/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "resolvido" }),
    });
    if (!r.ok) toast("Erro.", "error");
    else { toast("Marcada como resolvida.", "success"); carregar(); }
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

  const manutsFiltradas = manuts.filter((m) =>
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Máquinas</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            Gerencie a frota e acompanhe manutenções abertas.
          </p>
        </div>
        <Button
          className="w-full sm:w-auto"
          onClick={() => setEditing({ nome: "", tipo: "Trator", status: "operando" })}
        >
          + Nova máquina
        </Button>
      </div>

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
            className="rounded-xl p-3 text-center"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <p className="text-2xl font-extrabold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          className="flex-1 min-w-[160px] h-9 rounded-xl border px-3 text-sm"
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
              className="px-3 h-9 rounded-xl text-xs font-semibold border transition-all"
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
          className="rounded-2xl p-8 text-center text-sm"
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
        className="rounded-2xl overflow-hidden"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <div
          className="flex items-center justify-between px-5 py-3 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <h3 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>
            Ordens de Serviço
          </h3>
          <div className="flex gap-1">
            {(["abertas", "todas"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTabManut(t)}
                className="px-3 h-7 rounded-lg text-xs font-semibold border transition-all"
                style={{
                  background: tabManut === t ? "var(--accent)" : "transparent",
                  color: tabManut === t ? "#fff" : "var(--text-muted)",
                  borderColor: tabManut === t ? "var(--accent)" : "var(--border)",
                }}
              >
                {t === "abertas" ? `Abertas (${nOSAbertas})` : "Todas"}
              </button>
            ))}
          </div>
        </div>

        {manutsFiltradas.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            {tabManut === "abertas" ? "Nenhuma OS aberta. 🎉" : "Sem manutenções registradas."}
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
            {manutsFiltradas.map((m) => (
              <li
                key={m.id}
                className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="mt-1 shrink-0 inline-block w-2.5 h-2.5 rounded-full"
                    style={{
                      background:
                        m.status === "resolvido" ? "var(--success)"
                        : m.status === "aberto"    ? "var(--danger)"
                        :                            "var(--warn)",
                    }}
                  />
                  <div>
                    <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                      {m.maquinas?.nome}
                      {m.maquinas?.identificador && (
                        <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>
                          {" · "}{m.maquinas.identificador}
                        </span>
                      )}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{m.descricao}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      Aberto em {ddmmyyyy(m.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:shrink-0">
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full capitalize"
                    style={{
                      background:
                        m.status === "resolvido" ? "var(--success-bg, #f0fdf4)"
                        : m.status === "aberto"    ? "var(--danger-bg)"
                        :                            "var(--warn-bg)",
                      color:
                        m.status === "resolvido" ? "var(--success)"
                        : m.status === "aberto"    ? "var(--danger)"
                        :                            "var(--warn)",
                    }}
                  >
                    {m.status.replace("_", " ")}
                  </span>
                  {m.status !== "resolvido" && (
                    <button
                      onClick={() => resolverManut(m.id)}
                      className="text-xs font-bold"
                      style={{ color: "var(--accent)" }}
                    >
                      Resolver →
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
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
            className="rounded-2xl w-full max-w-md p-6 space-y-3"
            style={{ background: "var(--bg-card)" }}
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
