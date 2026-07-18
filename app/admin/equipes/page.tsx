"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import PageHeader from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { brl, todayISO } from "@/lib/format";
import type { Equipe, Producao } from "@/lib/types";
import BulkImportDialog, { type BulkImportColumn } from "@/components/bulk/BulkImportDialog";
import BulkSelectionBar from "@/components/bulk/BulkSelectionBar";
import { parseBooleanPtBr, responseError } from "@/lib/bulk-import";

const TEAM_COLUMNS: BulkImportColumn[] = [
  { key: "nome", label: "Nome", example: "Equipe Norte", required: true },
  { key: "descricao", label: "Descrição", example: "Frente de plantio" },
  { key: "ativo", label: "Ativo", example: "sim" },
];

const FILTER_KEY = "gn:equipes-filtro";

/* ── Sparkline 7 dias ─────────────────────────────────── */
function Sparkline({ values, color = "var(--accent)" }: { values: number[]; color?: string }) {
  const n = values.length;
  if (n === 0) return null;
  const max = Math.max(...values, 1);
  const W = 72, H = 28, gap = 2;
  const barW = (W - gap * (n - 1)) / n;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ display: "block", overflow: "visible" }}
    >
      {values.map((v, i) => {
        const h = Math.max(3, (v / max) * H);
        const x = i * (barW + gap);
        const y = H - h;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={h}
            rx={2}
            style={{ fill: color, opacity: v === 0 ? 0.2 : 0.85 }}
          />
        );
      })}
    </svg>
  );
}

/* ── Utilitário: últimos N dias ISO ────────────────────── */
function lastNDays(n: number): string[] {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const tz = d.getTimezoneOffset();
    days.push(new Date(d.getTime() - tz * 60_000).toISOString().slice(0, 10));
  }
  return days;
}

/* ── Card de equipe ────────────────────────────────────── */
function EquipeCard({
  equipe,
  producoesDaEquipe,
  days,
  onEdit,
  onInativar,
  selected,
  onSelect,
}: {
  equipe: Equipe;
  producoesDaEquipe: Producao[];
  days: string[];
  onEdit: () => void;
  onInativar: () => void;
  selected: boolean;
  onSelect: () => void;
}) {
  // Aggregate production per day
  const porDia = useMemo(() => {
    const map: Record<string, number> = {};
    days.forEach((d) => { map[d] = 0; });
    producoesDaEquipe.forEach((p) => {
      if (map[p.data] !== undefined) {
        map[p.data] += (p.quantidade ?? 0) * (p.valor_unitario_snapshot ?? 0);
      }
    });
    return days.map((d) => map[d]);
  }, [producoesDaEquipe, days]);

  const totalSemana = porDia.reduce((s, v) => s + v, 0);
  const diasAtivos  = porDia.filter((v) => v > 0).length;
  const hasActivity = totalSemana > 0;

  return (
    <div
      className="rounded-lg p-3 flex flex-col gap-3 animate-fade-in"
      style={{
        background: "var(--bg-card)",
        border: `1.5px solid ${equipe.ativo ? "var(--border)" : "var(--border)"}`,
        opacity: equipe.ativo ? 1 : 0.6,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <input type="checkbox" aria-label={`Selecionar ${equipe.nome}`} checked={selected} onChange={onSelect} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]" />
        <div className="min-w-0">
          <p
            className="font-bold text-sm leading-tight truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {equipe.nome}
          </p>
          {equipe.descricao && (
            <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
              {equipe.descricao}
            </p>
          )}
        </div>
        <span
          className="shrink-0 rounded-md px-2 py-0.5 text-xs font-bold"
          style={{
            background: equipe.ativo ? "var(--success-bg, #f0fdf4)" : "var(--bg-page)",
            color:      equipe.ativo ? "var(--success)" : "var(--text-muted)",
            border:     `1px solid ${equipe.ativo ? "var(--success)" : "var(--border)"}`,
          }}
        >
          {equipe.ativo ? "ativa" : "inativa"}
        </span>
      </div>

      {/* Sparkline + total */}
      <div className="flex items-end justify-between gap-2">
        {hasActivity ? (
          <div>
            <Sparkline values={porDia} />
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {diasAtivos}d ativo esta semana
            </p>
          </div>
        ) : (
          <div
            className="rounded-lg px-3 py-2 text-xs"
            style={{ background: "var(--bg-page)", color: "var(--text-muted)" }}
          >
            Sem produção nos últimos 7 dias
          </div>
        )}
        <div className="text-right shrink-0">
          <p className="text-sm font-bold" style={{ color: "var(--accent)" }}>
            {brl(totalSemana)}
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>7 dias</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={onEdit}
          className="flex-1 text-xs font-semibold py-1.5 rounded-lg border"
          style={{
            color: "var(--accent)",
            borderColor: "var(--accent)",
            background: "transparent",
          }}
        >
          Editar
        </button>
        {equipe.ativo && (
          <button
            onClick={onInativar}
            className="flex-1 text-xs font-semibold py-1.5 rounded-lg border"
            style={{
              color: "var(--danger)",
              borderColor: "var(--danger)",
              background: "transparent",
            }}
          >
            Inativar
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────── */
export default function EquipesPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<Equipe[]>([]);
  const [producoes, setProducoes] = useState<Producao[]>([]);
  const [editing, setEditing] = useState<Partial<Equipe> | null>(null);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem(FILTER_KEY) ?? "ativas";
    return "ativas";
  });
  const [loading, setLoading] = useState(true);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const days = useMemo(() => lastNDays(7), []);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const dataIni = days[0];
      const dataFim = todayISO();
      const [er, pr] = await Promise.all([
        fetch("/api/equipes").then((r) => r.json()),
        fetch(`/api/producao?data_de=${dataIni}&data_ate=${dataFim}`).then((r) => r.json()),
      ]);
      if (!er.items) throw new Error(er.error ?? "erro");
      setItems(Array.isArray(er.items) ? (er.items as Equipe[]) : []);
      setProducoes(Array.isArray(pr.items) ? (pr.items as Producao[]) : []);
    } catch (err) {
      toast(`Erro ao carregar: ${(err as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  }, [days, toast]);

  useEffect(() => { void carregar(); }, [carregar]);

  function setFiltro(v: string) {
    setStatusFiltro(v);
    localStorage.setItem(FILTER_KEY, v);
  }

  async function salvar() {
    if (!editing?.nome) { toast("Informe o nome.", "error"); return; }
    const url    = editing.id ? `/api/equipes/${editing.id}` : "/api/equipes";
    const method = editing.id ? "PATCH" : "POST";
    const r = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nome: editing.nome,
        descricao: editing.descricao ?? null,
        ativo: editing.ativo ?? true,
      }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast(`Erro: ${j.error ?? r.statusText}`, "error"); return;
    }
    toast("Equipe salva.", "success");
    setEditing(null);
    void carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Inativar equipe?")) return;
    const r = await fetch(`/api/equipes/${id}`, { method: "DELETE" });
    if (!r.ok) { toast("Erro.", "error"); return; }
    toast("Equipe inativada.", "success");
    void carregar();
  }

  async function importar(values: Record<string, string>) {
    await responseError(await fetch("/api/equipes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nome: values.nome.trim(), descricao: values.descricao.trim() || null, ativo: parseBooleanPtBr(values.ativo) }),
    }));
  }

  async function excluirSelecionadas() {
    if (!selected.size || !confirm(`Inativar ${selected.size} equipe${selected.size === 1 ? "" : "s"}?`)) return;
    setDeleting(true);
    let errors = 0;
    for (const id of selected) if (!(await fetch(`/api/equipes/${id}`, { method: "DELETE" })).ok) errors += 1;
    setDeleting(false);
    setSelected(new Set());
    toast(errors ? `${errors} equipe(s) não puderam ser inativadas.` : "Equipes inativadas.", errors ? "error" : "success");
    await carregar();
  }

  const filtradas = items.filter((e) => {
    if (statusFiltro === "ativas"   && !e.ativo) return false;
    if (statusFiltro === "inativas" &&  e.ativo) return false;
    if (busca) {
      const q = busca.toLowerCase();
      if (!e.nome.toLowerCase().includes(q) &&
          !(e.descricao ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalAtivas  = items.filter((e) => e.ativo).length;
  const totalInativas = items.filter((e) => !e.ativo).length;

  // Summary: total R$ esta semana across all teams
  const totalSemana = producoes.reduce(
    (s, p) => s + (p.quantidade ?? 0) * (p.valor_unitario_snapshot ?? 0), 0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        eyebrow="Cadastro"
        title="Equipes / Frentes"
        subtitle="Frentes de trabalho com desempenho dos últimos 7 dias."
        right={<div className="flex w-full gap-2 sm:w-auto"><Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => setBulkOpen(true)}>Importar em lote</Button><Button className="flex-1 sm:flex-none" onClick={() => setEditing({ nome: "", descricao: "", ativo: true })}>+ Nova equipe</Button></div>}
      />

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Ativas",          value: totalAtivas,              color: "var(--success)" },
          { label: "Inativas",        value: totalInativas,            color: "var(--text-muted)" },
          { label: "Faturamento 7d",  value: brl(totalSemana),         color: "var(--accent)", wide: true },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg p-3 text-center"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
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
          placeholder="Pesquisar equipes..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <div className="flex gap-1">
          {[
            { v: "",         label: "Todas"    },
            { v: "ativas",   label: `Ativas (${totalAtivas})`   },
            { v: "inativas", label: `Inativas (${totalInativas})` },
          ].map((f) => (
            <button
              key={f.v}
              onClick={() => setFiltro(f.v)}
              className="h-9 rounded-lg border px-3 text-xs font-semibold transition-all"
              style={{
                background:  statusFiltro === f.v ? "var(--accent)" : "var(--bg-card)",
                color:       statusFiltro === f.v ? "#fff" : "var(--text-secondary)",
                borderColor: statusFiltro === f.v ? "var(--accent)" : "var(--border)",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <BulkSelectionBar selectedCount={selected.size} visibleCount={filtradas.length} allVisibleSelected={filtradas.length > 0 && filtradas.every((item) => selected.has(item.id))} deleting={deleting} onToggleAll={() => setSelected((current) => filtradas.every((item) => current.has(item.id)) ? new Set() : new Set([...current, ...filtradas.map((item) => item.id)]))} onClear={() => setSelected(new Set())} onDelete={excluirSelecionadas} />

      {/* Grid */}
      {loading ? (
        <div className="text-center py-12 text-sm" style={{ color: "var(--text-muted)" }}>
          Carregando...
        </div>
      ) : filtradas.length === 0 ? (
        <div
          className="rounded-lg p-8 text-center text-sm"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
        >
          Nenhuma equipe encontrada.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtradas.map((e) => (
            <EquipeCard
              key={e.id}
              equipe={e}
              producoesDaEquipe={producoes.filter((p) => p.equipe_id === e.id)}
              days={days}
              onEdit={() => setEditing(e)}
              onInativar={() => excluir(e.id)}
              selected={selected.has(e.id)}
              onSelect={() => setSelected((current) => { const next = new Set(current); if (next.has(e.id)) next.delete(e.id); else next.add(e.id); return next; })}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {editing && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 z-50"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-md rounded-lg p-5 space-y-3"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            onClick={(ev) => ev.stopPropagation()}
          >
            <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              {editing.id ? "Editar" : "Nova"} equipe
            </h3>
            <Input
              label="Nome"
              value={editing.nome ?? ""}
              onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
            />
            <Input
              label="Descrição"
              value={editing.descricao ?? ""}
              onChange={(e) => setEditing({ ...editing, descricao: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button onClick={salvar}>Salvar</Button>
            </div>
          </div>
        </div>
      )}
      <BulkImportDialog open={bulkOpen} title="Importar equipes em lote" description="Cole várias frentes de trabalho e revise antes de cadastrar." columns={TEAM_COLUMNS} onClose={() => setBulkOpen(false)} onImportRow={importar} onComplete={carregar} />
    </div>
  );
}
