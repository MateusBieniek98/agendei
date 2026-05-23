"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { brl, todayISO } from "@/lib/format";
import { searchItems } from "@/components/ui/ListControls";
import { INSUMOS_CATALOGO, insumoCatalogDisplay, normalizeInsumoInput } from "@/lib/insumos";
import type { Atividade, Equipe, Producao, Projeto } from "@/lib/types";

/* ── Card de insumo com sugestões inline ── */
function InsumoCard({
  insumo,
  index,
  onChange,
}: {
  insumo: { nome: string; quantidade: string };
  index: number;
  onChange: (campo: "nome" | "quantidade", valor: string) => void;
}) {
  const [focado, setFocado] = useState(false);

  const sugestoes = useMemo(() => {
    const q = insumo.nome.trim().toLowerCase();
    if (q.length < 1) return [];
    return INSUMOS_CATALOGO.filter((i) =>
      insumoCatalogDisplay(i).toLowerCase().includes(q)
    ).slice(0, 6);
  }, [insumo.nome]);

  const mostrarLista = focado && sugestoes.length > 0;

  return (
    <div
      className="rounded-xl border-2 p-3 shadow-sm"
      style={{ background: "var(--bg-card-alt)" }}
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
        <label className="block">
          <span
            className="mb-1 block text-xs font-extrabold uppercase tracking-wide"
            style={{ color: "var(--text-secondary)" }}
          >
            Insumo {index + 1}
          </span>
          <input
            value={insumo.nome}
            onChange={(e) => onChange("nome", e.target.value)}
            onFocus={() => setFocado(true)}
            onBlur={() => setTimeout(() => setFocado(false), 150)}
            placeholder="Buscar por código ou nome"
            autoComplete="off"
            className="h-12 w-full rounded-xl border-2 bg-transparent px-3 text-sm font-bold outline-none"
            style={{ color: "var(--text-primary)", borderColor: "var(--border)" }}
          />
        </label>
        <label className="block">
          <span
            className="mb-1 block text-xs font-extrabold uppercase tracking-wide"
            style={{ color: "var(--text-secondary)" }}
          >
            Qtd
          </span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={insumo.quantidade}
            onChange={(e) => onChange("quantidade", e.target.value)}
            placeholder="0"
            className="h-12 w-full rounded-xl border-2 bg-transparent px-3 text-sm font-bold outline-none"
            style={{ color: "var(--text-primary)", borderColor: "var(--border)" }}
          />
        </label>
      </div>

      {mostrarLista && (
        <div
          className="mt-3 grid gap-2 rounded-xl border p-2"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
        >
          {sugestoes.map((item, i) => {
            const display = insumoCatalogDisplay(item);
            return (
              <button
                key={i}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange("nome", display);
                  setFocado(false);
                }}
                className="w-full rounded-lg px-3 py-2.5 text-left text-xs font-bold active:opacity-70"
                style={{ color: "var(--text-primary)", background: "var(--bg-card-alt)" }}
              >
                {display}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const STEPS = [
  { id: 1, label: "Onde / Quem" },
  { id: 2, label: "O Quê" },
  { id: 3, label: "Recursos" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

function emptyInsumos() {
  return Array.from({ length: 3 }, () => ({ nome: "", quantidade: "" }));
}

/* ── Stepper Header ── */
function StepperHeader({
  step,
  setStep,
  canAdvance,
}: {
  step: StepId;
  setStep: (s: StepId) => void;
  canAdvance: Record<StepId, boolean>;
}) {
  return (
    <div className="flex items-center gap-0 mb-6 select-none">
      {STEPS.map((s, i) => {
        const done = s.id < step;
        const active = s.id === step;
        const reachable = s.id < step || (s.id === step + 1 && canAdvance[step as StepId]);
        return (
          <div key={s.id} className="flex items-center gap-0 flex-1">
            <button
              type="button"
              disabled={!reachable && !done}
              onClick={() => (done || reachable) && setStep(s.id)}
              className="flex flex-col items-center gap-1 group"
              style={{ minWidth: 56 }}
            >
              <span
                className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                style={{
                  background: done
                    ? "var(--success)"
                    : active
                    ? "var(--accent)"
                    : "var(--bg-active)",
                  color: done || active ? "#fff" : "var(--text-muted)",
                  boxShadow: active ? "0 0 0 3px var(--accent-subtle)" : "none",
                }}
              >
                {done ? "✓" : s.id}
              </span>
              <span
                className="text-xs font-semibold whitespace-nowrap"
                style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}
              >
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div
                className="stepper-connector flex-1 mx-1 mt-[-12px]"
                style={{ background: done ? "var(--success)" : "var(--border)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Accordion ── */
function Accordion({
  title,
  hint,
  children,
  defaultOpen = false,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--border)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left transition"
        style={{ background: open ? "var(--bg-card-alt)" : "var(--bg-card)" }}
      >
        <div>
          <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            {title}
          </span>
          {hint && !open && (
            <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>
              {hint}
            </span>
          )}
        </div>
        <span
          className="text-lg transition-transform"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            color: "var(--text-muted)",
          }}
        >
          ›
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 space-y-3 animate-fade-in" style={{ background: "var(--bg-card)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Seletor pesquisável — melhor para campo e listas grandes ── */
function SearchablePicker<T>({
  label,
  search,
  onSearchChange,
  items,
  selectedId,
  onSelect,
  getId,
  renderTitle,
  renderSubtitle,
  placeholder,
  emptyLabel,
  limit = 6,
}: {
  label: string;
  search: string;
  onSearchChange: (value: string) => void;
  items: T[];
  selectedId: string;
  onSelect: (item: T) => void;
  getId: (item: T) => string;
  renderTitle: (item: T) => React.ReactNode;
  renderSubtitle?: (item: T) => React.ReactNode;
  placeholder: string;
  emptyLabel: string;
  limit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const selected = items.find((item) => getId(item) === selectedId);
  const orderedItems = selected
    ? [selected, ...items.filter((item) => getId(item) !== selectedId)]
    : items;
  const canToggle = orderedItems.length > limit;
  const visibleItems = expanded ? orderedItems : orderedItems.slice(0, limit);

  useEffect(() => {
    setExpanded(false);
  }, [search]);

  return (
    <div
      className="rounded-2xl border-2 p-3 shadow-sm"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            {label}
          </p>
          <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
            {selected ? "Selecionado" : "Pesquise e toque para selecionar"}
          </p>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-xs font-bold"
          style={{
            background: selected ? "var(--accent-subtle)" : "var(--bg-card-alt)",
            color: selected ? "var(--accent)" : "var(--text-muted)",
          }}
        >
          {items.length}
        </span>
      </div>

      <Input
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
        placeholder={placeholder}
        aria-label={`Pesquisar ${label.toLowerCase()}`}
        className="h-12"
      />

      <div className="mt-3 flex flex-col gap-2" role="listbox" aria-label={label}>
        {visibleItems.map((item) => {
          const id = getId(item);
          const active = id === selectedId;
          return (
            <button
              key={id}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => {
                onSelect(item);
                onSearchChange("");
              }}
              className="w-full rounded-xl border-2 px-3 py-3 text-left transition active:scale-[0.99]"
              style={{
                background: active ? "var(--accent-subtle)" : "var(--bg-card-alt)",
                borderColor: active ? "var(--accent)" : "var(--border)",
                boxShadow: active ? "0 0 0 2px var(--accent-subtle)" : "none",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className="break-words text-sm font-extrabold leading-snug"
                    style={{ color: active ? "var(--accent)" : "var(--text-primary)" }}
                  >
                    {renderTitle(item)}
                  </p>
                  {renderSubtitle && (
                    <p
                      className="mt-1 break-words text-xs font-semibold leading-snug"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {renderSubtitle(item)}
                    </p>
                  )}
                </div>
                {active && (
                  <span
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-black text-white"
                    style={{ background: "var(--accent)" }}
                  >
                    ✓
                  </span>
                )}
              </div>
            </button>
          );
        })}

        {visibleItems.length === 0 && (
          <div
            className="rounded-xl border px-3 py-4 text-center text-sm font-bold"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            {emptyLabel}
          </div>
        )}
      </div>

      {canToggle && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-3 w-full rounded-xl px-3 py-2.5 text-sm font-bold transition"
          style={{ background: "var(--bg-active)", color: "var(--text-primary)" }}
        >
          {expanded ? "Recolher opções" : `Mostrar mais ${items.length - limit}`}
        </button>
      )}
    </div>
  );
}

/* ── Banner de pré-preenchimento do planejamento ── */
function BannerPlanejamento({
  atividadeNome,
  projetoNome,
  talhao,
  onDescartar,
  variant = "planejamento",
}: {
  atividadeNome: string;
  projetoNome: string;
  talhao: string;
  onDescartar?: () => void;
  variant?: "planejamento" | "edicao";
}) {
  return (
    <div
      className="rounded-2xl p-4 mb-2 animate-slide-up flex items-start justify-between gap-3"
      style={{ background: "var(--success-bg)", border: "1px solid var(--success)" }}
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "var(--success)" }}>
          {variant === "edicao" ? "Editando apontamento" : "Atividade planejada"}
        </p>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {atividadeNome}
        </p>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {projetoNome}{talhao ? ` · Talhão ${talhao}` : ""}
        </p>
      </div>
      {onDescartar && (
        <button
          type="button"
          onClick={onDescartar}
          className="shrink-0 text-xs font-bold"
          style={{ color: "var(--text-muted)" }}
        >
          x
        </button>
      )}
    </div>
  );
}

type EditingItem = Pick<
  Producao,
  | "id"
  | "data"
  | "equipe_id"
  | "atividade_id"
  | "projeto_id"
  | "talhao"
  | "quantidade"
  | "insumos"
  | "descarte"
  | "observacoes"
>;

function maskTalhao(value: string | null | undefined) {
  if (!value) return "";
  const raw = value.replace(/\D/g, "").slice(0, 5);
  return raw.length > 3 ? `${raw.slice(0, 3)}-${raw.slice(3)}` : raw;
}

function initialInsumos(editingItem?: EditingItem) {
  if (!editingItem?.insumos?.length) return emptyInsumos();
  return editingItem.insumos.map((insumo) => ({
    nome: insumo.nome ?? "",
    quantidade: String(insumo.quantidade ?? ""),
  }));
}

/* ── Formulário principal ── */
export default function LancamentoForm({
  equipes,
  atividades,
  projetos,
  initialAtividadeId,
  initialProjetoId,
  initialTalhao,
  editingItem,
}: {
  equipes: Equipe[];
  atividades: Atividade[];
  projetos: Projeto[];
  initialAtividadeId?: string;
  initialProjetoId?: string;
  initialTalhao?: string;
  editingItem?: EditingItem;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const modoEdicao = !!editingItem;
  const [step, setStep] = useState<StepId>(1);
  const [temPrefill, setTemPrefill] = useState(
    !!(editingItem || initialAtividadeId || initialProjetoId || initialTalhao)
  );

  // Form state — initial values from URL params when coming from Planejamento
  const [data,      setData]      = useState(editingItem?.data ?? todayISO());
  const [equipeId,  setEquipeId]  = useState(editingItem?.equipe_id ?? equipes[0]?.id ?? "");
  const [projetoId, setProjetoId] = useState(editingItem?.projeto_id ?? initialProjetoId ?? projetos[0]?.id ?? "");
  const [talhao,    setTalhao]    = useState(() => maskTalhao(editingItem?.talhao ?? initialTalhao));
  const [atividadeId,    setAtividadeId]    = useState(editingItem?.atividade_id ?? initialAtividadeId ?? atividades[0]?.id ?? "");
  const [atividadeBusca, setAtividadeBusca] = useState("");
  const [projetoBusca,   setProjetoBusca]   = useState("");
  const [qtd,            setQtd]            = useState(editingItem ? String(Number(editingItem.quantidade)) : "");
  const [descarte,       setDescarte]       = useState(
    editingItem?.descarte != null ? String(Number(editingItem.descarte)) : ""
  );
  const [insumos,        setInsumos]        = useState(() => initialInsumos(editingItem));
  const [obs,            setObs]            = useState(editingItem?.observacoes ?? "");
  const [enviando,       setEnviando]       = useState(false);

  const atividade = useMemo(
    () => atividades.find((a) => a.id === atividadeId),
    [atividades, atividadeId]
  );
  const valorEstimado = atividade && qtd ? Number(qtd) * Number(atividade.valor_unitario) : 0;

  const atividadesFiltradas = useMemo(
    () => searchItems(atividades, atividadeBusca, [(a) => a.nome, (a) => a.unidade]),
    [atividades, atividadeBusca]
  );
  const projetosFiltrados = useMemo(
    () => searchItems(projetos, projetoBusca, [(p) => p.nome]),
    [projetos, projetoBusca]
  );
  const atividadeOptions = useMemo(() => {
    const sel = atividadeId ? atividades.find((a) => a.id === atividadeId) : undefined;
    return sel && !atividadesFiltradas.some((a) => a.id === sel.id)
      ? [sel, ...atividadesFiltradas]
      : atividadesFiltradas;
  }, [atividadeId, atividades, atividadesFiltradas]);
  const projetoOptions = useMemo(() => {
    const sel = projetoId ? projetos.find((p) => p.id === projetoId) : undefined;
    return sel && !projetosFiltrados.some((p) => p.id === sel.id)
      ? [sel, ...projetosFiltrados]
      : projetosFiltrados;
  }, [projetoId, projetos, projetosFiltrados]);

  const insumosValidos = useMemo(
    () =>
      insumos
        .map((i) => ({ nome: normalizeInsumoInput(i.nome), quantidade: Number(i.quantidade) }))
        .filter((i) => i.nome && Number.isFinite(i.quantidade) && i.quantidade > 0),
    [insumos]
  );
  const insumosHint =
    insumosValidos.length > 0 ? `${insumosValidos.length} adicionado${insumosValidos.length > 1 ? "s" : ""}` : undefined;

  const talhaoValido = /^\d{3}-\d{2}$/.test(talhao.trim());
  const canAdvance: Record<StepId, boolean> = {
    1: !!equipeId && !!projetoId && talhaoValido,
    2: !!atividadeId && !!qtd && Number(qtd) > 0,
    3: true,
  };

  function alterarInsumo(index: number, campo: "nome" | "quantidade", valor: string) {
    setInsumos((a) => a.map((insumo, i) => (i === index ? { ...insumo, [campo]: valor } : insumo)));
  }

  function limpar() {
    setQtd(""); setTalhao(""); setDescarte(""); setInsumos(emptyInsumos()); setObs("");
    setTemPrefill(false);
  }

  async function enviarDados(formData: object) {
    setEnviando(true);
    try {
      const r = await fetch(modoEdicao ? `/api/producao/${editingItem!.id}` : "/api/producao", {
        method: modoEdicao ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Falha ao salvar");
      }
      return true;
    } catch (err) {
      if (modoEdicao) {
        toast(`Erro: ${(err as Error).message}`, "error");
        return false;
      }
      try {
        const pend = JSON.parse(localStorage.getItem("gn:pendentes") ?? "[]");
        pend.push({ ...formData, ts: Date.now() });
        localStorage.setItem("gn:pendentes", JSON.stringify(pend));
        toast("Sem conexão — salvo offline. Reenviaremos depois.", "info");
        return true;
      } catch {
        toast(`Erro: ${(err as Error).message}`, "error");
        return false;
      }
    } finally {
      setEnviando(false);
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!equipeId || !atividadeId || !projetoId || !qtd || Number(qtd) <= 0) {
      toast("Preencha todos os campos obrigatórios.", "error");
      return;
    }
    if (!talhaoValido) {
      toast("Talhão inválido. Use o formato 000-00 (ex.: 018-01).", "error");
      return;
    }
    const formData = {
      data, equipe_id: equipeId, atividade_id: atividadeId,
      projeto_id: projetoId, talhao: talhao.trim(),
      quantidade: Number(qtd),
      descarte: descarte === "" ? null : Number(descarte),
      insumos: insumosValidos, observacoes: obs || null,
    };
    const ok = await enviarDados(formData);
    if (ok) {
      toast(modoEdicao ? "Apontamento atualizado!" : "Produção registrada!", "success");
      if (modoEdicao) {
        router.push("/resumo");
        router.refresh();
        return;
      }
      limpar();
      setStep(1);
    }
  }

  const prefillAtividade = temPrefill ? atividades.find((a) => a.id === atividadeId) : null;
  const prefillProjeto   = temPrefill ? projetos.find((p) => p.id === projetoId) : null;

  return (
    <form onSubmit={salvar} className="space-y-4">
      {/* Banner de planejamento */}
      {temPrefill && prefillAtividade && prefillProjeto && step === 1 && (
        <BannerPlanejamento
          atividadeNome={prefillAtividade.nome}
          projetoNome={prefillProjeto.nome}
          talhao={talhao}
          variant={modoEdicao ? "edicao" : "planejamento"}
          onDescartar={modoEdicao ? undefined : () => setTemPrefill(false)}
        />
      )}

      {/* Stepper */}
      <StepperHeader step={step} setStep={setStep} canAdvance={canAdvance} />

      {/* ── STEP 1: Onde / Quem ── */}
      {step === 1 && (
        <div className="space-y-4 animate-fade-in">
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
          <SearchablePicker
            label="Projeto"
            search={projetoBusca}
            onSearchChange={setProjetoBusca}
            items={projetoOptions}
            selectedId={projetoId}
            onSelect={(projeto) => setProjetoId(projeto.id)}
            getId={(projeto) => projeto.id}
            renderTitle={(projeto) => projeto.nome}
            placeholder="Buscar projeto ou fazenda"
            emptyLabel="Nenhum projeto encontrado."
          />
          <Input
            label="Talhão *"
            value={talhao}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, "").slice(0, 5);
              const masked = raw.length > 3 ? `${raw.slice(0, 3)}-${raw.slice(3)}` : raw;
              setTalhao(masked);
            }}
            placeholder="Ex.: 018-01"
            hint={talhao && !talhaoValido ? "Formato: 000-00 (ex.: 018-01)" : undefined}
            inputMode="numeric"
          />
          <button
            type="button"
            disabled={!canAdvance[1]}
            onClick={() => setStep(2)}
            className="w-full rounded-xl py-3.5 text-sm font-bold text-white transition disabled:opacity-40"
            style={{ background: "var(--accent)" }}
          >
            Próximo: O Quê →
          </button>
        </div>
      )}

      {/* ── STEP 2: O Quê ── */}
      {step === 2 && (
        <div className="space-y-4 animate-fade-in">
          <SearchablePicker
            label="Atividade / serviço"
            search={atividadeBusca}
            onSearchChange={setAtividadeBusca}
            items={atividadeOptions}
            selectedId={atividadeId}
            onSelect={(atividadeItem) => setAtividadeId(atividadeItem.id)}
            getId={(atividadeItem) => atividadeItem.id}
            renderTitle={(atividadeItem) => atividadeItem.nome}
            renderSubtitle={(atividadeItem) =>
              `${brl(atividadeItem.valor_unitario)} / ${atividadeItem.unidade}`
            }
            placeholder="Buscar pelo nome do serviço"
            emptyLabel="Nenhuma atividade encontrada."
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

          {valorEstimado > 0 && (
            <div
              className="rounded-xl px-4 py-3 animate-fade-in"
              style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent)" }}
            >
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--accent)" }}>
                Valor estimado
              </p>
              <p className="text-2xl font-bold tabular mt-0.5" style={{ color: "var(--accent)" }}>
                {brl(valorEstimado)}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 rounded-xl py-3.5 text-sm font-bold transition"
              style={{ background: "var(--bg-active)", color: "var(--text-primary)" }}
            >
              ← Voltar
            </button>
            <button
              type="button"
              disabled={!canAdvance[2]}
              onClick={() => setStep(3)}
              className="flex-[2] rounded-xl py-3.5 text-sm font-bold text-white transition disabled:opacity-40"
              style={{ background: "var(--accent)" }}
            >
              Próximo: Recursos →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Recursos ── */}
      {step === 3 && (
        <div className="space-y-4 animate-fade-in">
          <div
            className="rounded-xl px-4 py-3 space-y-1"
            style={{ background: "var(--bg-card-alt)", border: "1px solid var(--border)" }}
          >
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Resumo
            </p>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {atividade?.nome ?? "—"} · {Number(qtd).toFixed(2)} {atividade?.unidade}
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {equipes.find((e) => e.id === equipeId)?.nome} · {projetos.find((p) => p.id === projetoId)?.nome}
              {talhao ? ` · Talhão ${talhao}` : ""}
            </p>
            {valorEstimado > 0 && (
              <p className="text-sm font-bold tabular" style={{ color: "var(--accent)" }}>
                {brl(valorEstimado)}
              </p>
            )}
          </div>

          <Accordion title="Insumos utilizados" hint={insumosHint}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Digite parte do código ou nome. Não aparece para o gestor.
            </p>
            <div className="flex flex-col gap-2">
              {insumos.map((insumo, index) => (
                <InsumoCard
                  key={index}
                  insumo={insumo}
                  index={index}
                  onChange={(campo, valor) => alterarInsumo(index, campo, valor)}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setInsumos((v) => [...v, { nome: "", quantidade: "" }])}
              className="text-xs font-semibold"
              style={{ color: "var(--accent)" }}
            >
              + Adicionar insumo
            </button>
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
          </Accordion>

          <Accordion title="Observações" hint={obs ? "preenchido" : undefined}>
            <Input
              label="Observações"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Ocorrências, clima, atrasos…"
            />
          </Accordion>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex-1 rounded-xl py-3.5 text-sm font-bold transition"
              style={{ background: "var(--bg-active)", color: "var(--text-primary)" }}
            >
              ← Voltar
            </button>
            <Button
              type="submit"
              size="field"
              loading={enviando}
              className="flex-[2] btn-field"
            >
              {modoEdicao ? "Atualizar apontamento" : "Registrar produção"}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
