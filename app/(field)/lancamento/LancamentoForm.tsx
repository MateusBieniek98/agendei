"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { brl, todayISO } from "@/lib/format";
import { searchItems } from "@/components/ui/ListControls";
import { INSUMOS_CATALOGO, insumoCatalogDisplay, normalizeInsumoInput } from "@/lib/insumos";
import type { Atividade, Equipe, Projeto } from "@/lib/types";

const STEPS = [
  { id: 1, label: "Onde / Quem" },
  { id: 2, label: "O Quê" },
  { id: 3, label: "Recursos" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

type FormData = {
  data: string;
  equipeId: string;
  projetoId: string;
  talhao: string;
  atividadeId: string;
  qtd: string;
  descarte: string;
  insumos: { nome: string; quantidade: string }[];
  obs: string;
};

const STORAGE_KEY = "gn:ultimo-lancamento";

function emptyInsumos() {
  return Array.from({ length: 3 }, () => ({ nome: "", quantidade: "" }));
}

function loadUltimoLancamento(): Partial<FormData> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveUltimoLancamento(f: FormData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(f));
  } catch {}
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

/* ── Lançamento Rápido ── */
function LancamentoRapido({
  ultimo,
  equipes,
  atividades,
  projetos,
  onUsar,
}: {
  ultimo: Partial<FormData>;
  equipes: Equipe[];
  atividades: Atividade[];
  projetos: Projeto[];
  onUsar: (qtd: string) => void;
}) {
  const [qtdRapida, setQtdRapida] = useState("");
  const equipe = equipes.find((e) => e.id === ultimo.equipeId);
  const atividade = atividades.find((a) => a.id === ultimo.atividadeId);
  const projeto = projetos.find((p) => p.id === ultimo.projetoId);
  if (!equipe || !atividade || !projeto) return null;

  return (
    <div
      className="rounded-2xl p-4 mb-4 animate-slide-up"
      style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent)" }}
    >
      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--accent)" }}>
        ⚡ Lançamento rápido — repetir último
      </p>
      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        {atividade.nome} · {projeto.nome}
      </p>
      <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
        {equipe.nome} {ultimo.talhao ? `· Talhão ${ultimo.talhao}` : ""}
      </p>
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={qtdRapida}
          onChange={(e) => setQtdRapida(e.target.value)}
          placeholder={`Qtd (${atividade.unidade})`}
          className="flex-1 rounded-xl border px-3 py-2 text-sm font-bold"
          style={{
            background: "var(--bg-input)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
        />
        <button
          type="button"
          disabled={!qtdRapida || Number(qtdRapida) <= 0}
          onClick={() => onUsar(qtdRapida)}
          className="rounded-xl px-4 py-2 text-sm font-bold text-white transition disabled:opacity-40"
          style={{ background: "var(--accent)" }}
        >
          Registrar
        </button>
      </div>
    </div>
  );
}

/* ── Formulário principal ── */
export default function LancamentoForm({
  equipes,
  atividades,
  projetos,
}: {
  equipes: Equipe[];
  atividades: Atividade[];
  projetos: Projeto[];
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<StepId>(1);
  const [ultimoLancamento, setUltimoLancamento] = useState<Partial<FormData> | null>(null);

  // Form state
  const [data, setData] = useState(todayISO());
  const [equipeId, setEquipeId] = useState(equipes[0]?.id ?? "");
  const [projetoId, setProjetoId] = useState(projetos[0]?.id ?? "");
  const [talhao, setTalhao] = useState("");
  const [atividadeId, setAtividadeId] = useState(atividades[0]?.id ?? "");
  const [atividadeBusca, setAtividadeBusca] = useState("");
  const [projetoBusca, setProjetoBusca] = useState("");
  const [qtd, setQtd] = useState("");
  const [descarte, setDescarte] = useState("");
  const [insumos, setInsumos] = useState(emptyInsumos);
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setUltimoLancamento(loadUltimoLancamento());
  }, []);

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

  // Validação por step
  const canAdvance: Record<StepId, boolean> = {
    1: !!equipeId && !!projetoId,
    2: !!atividadeId && !!qtd && Number(qtd) > 0,
    3: true,
  };

  function alterarInsumo(index: number, campo: "nome" | "quantidade", valor: string) {
    setInsumos((a) => a.map((insumo, i) => (i === index ? { ...insumo, [campo]: valor } : insumo)));
  }

  function limpar() {
    setQtd(""); setTalhao(""); setDescarte(""); setInsumos(emptyInsumos()); setObs("");
  }

  async function enviarDados(formData: object) {
    setEnviando(true);
    try {
      const r = await fetch("/api/producao", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Falha ao salvar");
      }
      return true;
    } catch (err) {
      // Salva offline
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
    const formData = {
      data, equipe_id: equipeId, atividade_id: atividadeId,
      projeto_id: projetoId, talhao: talhao.trim(),
      quantidade: Number(qtd),
      descarte: descarte === "" ? null : Number(descarte),
      insumos: insumosValidos, observacoes: obs || null,
    };
    const ok = await enviarDados(formData);
    if (ok) {
      saveUltimoLancamento({
        data, equipeId, projetoId, talhao, atividadeId, qtd,
        descarte, insumos, obs,
      });
      setUltimoLancamento({ data, equipeId, projetoId, talhao, atividadeId });
      toast("Produção registrada!", "success");
      limpar();
      setStep(1);
    }
  }

  async function lancamentoRapido(qtdRapida: string) {
    if (!ultimoLancamento) return;
    const formData = {
      data: todayISO(),
      equipe_id: ultimoLancamento.equipeId,
      atividade_id: ultimoLancamento.atividadeId,
      projeto_id: ultimoLancamento.projetoId,
      talhao: ultimoLancamento.talhao ?? "",
      quantidade: Number(qtdRapida),
      descarte: null, insumos: [], observacoes: null,
    };
    const ok = await enviarDados(formData);
    if (ok) toast("Lançamento rápido registrado!", "success");
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      <datalist id="gn-insumos-catalogo">
        {INSUMOS_CATALOGO.map((insumo) => (
          <option key={`${insumo.codigo ?? insumo.grupo}-${insumo.nome}`} value={insumoCatalogDisplay(insumo)} />
        ))}
      </datalist>

      {/* Lançamento Rápido */}
      {ultimoLancamento && step === 1 && (
        <LancamentoRapido
          ultimo={ultimoLancamento}
          equipes={equipes}
          atividades={atividades}
          projetos={projetos}
          onUsar={lancamentoRapido}
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
          <Input
            label="Buscar projeto"
            type="search"
            value={projetoBusca}
            onChange={(e) => setProjetoBusca(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
            placeholder="Digite parte da fazenda/projeto"
          />
          <Select
            label="Projeto"
            value={projetoId}
            onChange={(e) => setProjetoId(e.target.value)}
            options={projetoOptions.map((p) => ({ value: p.id, label: p.nome }))}
            placeholder="Selecione…"
          />
          <Input
            label="Talhão (opcional)"
            value={talhao}
            onChange={(e) => setTalhao(e.target.value)}
            placeholder="Ex.: 017-01"
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
          <Input
            label="Buscar atividade"
            type="search"
            value={atividadeBusca}
            onChange={(e) => setAtividadeBusca(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
            placeholder="Digite parte do serviço"
          />
          <Select
            label="Atividade / serviço"
            value={atividadeId}
            onChange={(e) => setAtividadeId(e.target.value)}
            options={atividadeOptions.map((a) => ({
              value: a.id,
              label: `${a.nome} · ${brl(a.valor_unitario)}/${a.unidade}`,
            }))}
            placeholder="Selecione…"
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

          {/* Preview de valor */}
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
          {/* Resumo do que foi selecionado */}
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

          {/* Insumos — accordion */}
          <Accordion title="Insumos utilizados" hint={insumosHint}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Digite parte do código ou nome. Não aparece para o gestor.
            </p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {insumos.map((insumo, index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-lg border border-[var(--border)]"
                  style={{ background: "var(--bg-card-alt)" }}
                >
                  <input
                    list="gn-insumos-catalogo"
                    value={insumo.nome}
                    onChange={(e) => alterarInsumo(index, "nome", e.target.value)}
                    placeholder={`Insumo ${index + 1}`}
                    className="w-full border-b border-[var(--border)] bg-transparent px-2 py-1 text-xs font-bold outline-none"
                    style={{ color: "var(--text-primary)" }}
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={insumo.quantidade}
                    onChange={(e) => alterarInsumo(index, "quantidade", e.target.value)}
                    placeholder="Qtd"
                    className="w-full bg-transparent px-2 py-1 text-xs font-bold outline-none"
                    style={{ color: "var(--text-primary)" }}
                  />
                </div>
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

          {/* Observações — accordion */}
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
              ✓ Registrar produção
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
