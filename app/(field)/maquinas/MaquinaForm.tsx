"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Badge from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import ListControls, { searchItems, visibleItems } from "@/components/ui/ListControls";
import { useToast } from "@/components/ui/Toast";
import { ddmmyyyy } from "@/lib/format";
import type { Equipe, MachineStatus, Maquina, MaintenanceStatus, Projeto } from "@/lib/types";

const STATUS_OPTS: { value: MachineStatus; label: string }[] = [
  { value: "operando", label: "Funcionando / operando" },
  { value: "parada", label: "Parada" },
  { value: "manutencao_urgente", label: "Manutenção urgente" },
];

const MACHINE_STATUS_META: Record<MachineStatus, { label: string; tone: "success" | "warning" | "danger"; color: string; bg: string; border: string }> = {
  operando: {
    label: "Operando",
    tone: "success",
    color: "var(--success)",
    bg: "var(--success-bg)",
    border: "var(--success)",
  },
  parada: {
    label: "Parada",
    tone: "warning",
    color: "var(--warn)",
    bg: "var(--warn-bg)",
    border: "var(--warn)",
  },
  manutencao_urgente: {
    label: "Manutenção urgente",
    tone: "danger",
    color: "var(--danger)",
    bg: "var(--danger-bg)",
    border: "var(--danger)",
  },
};

const FILTER_KEY = "gn:field-maquinas-filtro";

type ManutPendente = {
  id: string;
  maquina_id: string;
  descricao: string;
  status: MaintenanceStatus;
  created_at: string;
  talhao: string | null;
  maquinas: { nome: string; tipo: string; identificador: string | null; status: MachineStatus } | null;
  equipes: { nome: string } | null;
  projetos: { nome: string } | null;
};

function MachinePicker({
  maquinas,
  allMaquinas,
  selected,
  selectedId,
  busca,
  onBuscaChange,
  filtroStatus,
  onFiltroStatusChange,
  onSelect,
}: {
  maquinas: Maquina[];
  allMaquinas: Maquina[];
  selected: Maquina | undefined;
  selectedId: string;
  busca: string;
  onBuscaChange: (value: string) => void;
  filtroStatus: string;
  onFiltroStatusChange: (value: string) => void;
  onSelect: (id: string) => void;
}) {
  const statusCounts = {
    operando: allMaquinas.filter((m) => m.status === "operando").length,
    parada: allMaquinas.filter((m) => m.status === "parada").length,
    manutencao_urgente: allMaquinas.filter((m) => m.status === "manutencao_urgente").length,
  };

  return (
    <section
      className="rounded-2xl border p-3 shadow-sm"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
            Escolha a máquina
          </h3>
          <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            {selected
              ? `${selected.nome}${selected.identificador ? ` · ${selected.identificador}` : ""}`
              : "Nenhuma máquina selecionada"}
          </p>
        </div>
        {selected && (
          <Badge tone={MACHINE_STATUS_META[selected.status].tone}>
            {MACHINE_STATUS_META[selected.status].label}
          </Badge>
        )}
      </div>

      <div className="mt-3">
        <label className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>
          Buscar por nome, código ou tipo
        </label>
        <div className="mt-1 flex min-h-12 items-center rounded-xl border-2 px-3" style={{ background: "var(--bg-input, var(--bg-card))", borderColor: "var(--border)" }}>
          <input
            type="search"
            value={busca}
            onChange={(e) => onBuscaChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
            className="min-w-0 flex-1 bg-transparent text-base font-bold outline-none"
            style={{ color: "var(--text-primary)" }}
            placeholder="Ex.: TR-012, trator, roçadeira"
          />
          {busca && (
            <button
              type="button"
              onClick={() => onBuscaChange("")}
              className="ml-2 min-h-9 rounded-lg px-2 text-xs font-black"
              style={{ color: "var(--accent)" }}
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { v: "", label: "Todas", count: allMaquinas.length, color: "var(--accent)", bg: "var(--accent-subtle)" },
          { v: "operando", label: "Operando", count: statusCounts.operando, color: "var(--success)", bg: "var(--success-bg)" },
          { v: "parada", label: "Paradas", count: statusCounts.parada, color: "var(--warn)", bg: "var(--warn-bg)" },
          { v: "manutencao_urgente", label: "Urgentes", count: statusCounts.manutencao_urgente, color: "var(--danger)", bg: "var(--danger-bg)" },
        ].map((option) => {
          const active = filtroStatus === option.v;
          return (
            <button
              key={option.v}
              type="button"
              onClick={() => onFiltroStatusChange(option.v)}
              className="min-h-11 rounded-xl border px-2 text-xs font-black transition active:opacity-80"
              style={{
                background: active ? option.color : option.bg,
                borderColor: active ? option.color : "var(--border)",
                color: active ? "#fff" : option.color,
              }}
            >
              {option.label} ({option.count})
            </button>
          );
        })}
      </div>

      <div className="mt-3 max-h-[19rem] space-y-2 overflow-y-auto pr-1">
        {maquinas.length === 0 ? (
          <div
            className="rounded-xl border border-dashed p-4 text-center text-sm font-semibold"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            Nenhuma máquina encontrada.
          </div>
        ) : (
          maquinas.map((maquina) => {
            const meta = MACHINE_STATUS_META[maquina.status];
            const active = selectedId === maquina.id;
            return (
              <button
                key={maquina.id}
                type="button"
                onClick={() => onSelect(maquina.id)}
                aria-pressed={active}
                className="flex min-h-16 w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition active:scale-[0.99]"
                style={{
                  background: active ? "var(--accent-subtle)" : "var(--bg-page)",
                  borderColor: active ? "var(--accent)" : "var(--border)",
                }}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-black" style={{ color: "var(--text-primary)" }}>
                    {maquina.nome}
                  </p>
                  <p className="truncate text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                    {maquina.tipo}
                    {maquina.identificador ? ` · ${maquina.identificador}` : ""}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-full px-2 py-1 text-[11px] font-black"
                  style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}
                >
                  {meta.label}
                </span>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

function ProjectPicker({
  projetos,
  selected,
  selectedId,
  busca,
  onBuscaChange,
  onSelect,
}: {
  projetos: Projeto[];
  selected: Projeto | undefined;
  selectedId: string;
  busca: string;
  onBuscaChange: (value: string) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <section
      className="rounded-2xl border p-3 shadow-sm"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
    >
      <div>
        <h3 className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
          Projeto / fazenda
        </h3>
        <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
          {selected?.nome ?? "Nenhum projeto selecionado"}
        </p>
      </div>

      <div className="mt-3">
        <label className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>
          Buscar projeto
        </label>
        <div className="mt-1 flex min-h-12 items-center rounded-xl border-2 px-3" style={{ background: "var(--bg-input, var(--bg-card))", borderColor: "var(--border)" }}>
          <input
            type="search"
            value={busca}
            onChange={(e) => onBuscaChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
            className="min-w-0 flex-1 bg-transparent text-base font-bold outline-none"
            style={{ color: "var(--text-primary)" }}
            placeholder="Digite parte do projeto ou fazenda"
          />
          {busca && (
            <button
              type="button"
              onClick={() => onBuscaChange("")}
              className="ml-2 min-h-9 rounded-lg px-2 text-xs font-black"
              style={{ color: "var(--accent)" }}
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
        {projetos.length === 0 ? (
          <div
            className="rounded-xl border border-dashed p-4 text-center text-sm font-semibold"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            Nenhum projeto encontrado.
          </div>
        ) : (
          projetos.map((projeto) => {
            const active = selectedId === projeto.id;
            return (
              <button
                key={projeto.id}
                type="button"
                onClick={() => onSelect(projeto.id)}
                aria-pressed={active}
                className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition active:scale-[0.99]"
                style={{
                  background: active ? "var(--accent-subtle)" : "var(--bg-page)",
                  borderColor: active ? "var(--accent)" : "var(--border)",
                }}
              >
                <span className="min-w-0 truncate text-sm font-black" style={{ color: "var(--text-primary)" }}>
                  {projeto.nome}
                </span>
                {active && (
                  <span className="shrink-0 rounded-full px-2 py-1 text-[11px] font-black" style={{ background: "var(--accent)", color: "#fff" }}>
                    Selecionado
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

export default function MaquinaForm({
  maquinas,
  equipes,
  projetos,
}: {
  maquinas: Maquina[];
  equipes: Equipe[];
  projetos: Projeto[];
}) {
  const { toast } = useToast();
  const [items, setItems] = useState<Maquina[]>(maquinas);
  const [maquinaId, setMaquinaId] = useState(items[0]?.id ?? "");
  const [maquinaBusca, setMaquinaBusca] = useState("");
  const [equipeId, setEquipeId] = useState(equipes[0]?.id ?? "");
  const [projetoId, setProjetoId] = useState(projetos[0]?.id ?? "");
  const [projetoBusca, setProjetoBusca] = useState("");
  const [talhao, setTalhao] = useState("");
  const maquinaSelecionada = useMemo(
    () => items.find((m) => m.id === maquinaId),
    [items, maquinaId]
  );
  const [statusMaquina, setStatusMaquina] = useState<MachineStatus>(
    maquinaSelecionada?.status === "operando"
      ? "manutencao_urgente"
      : (maquinaSelecionada?.status ?? "manutencao_urgente")
  );
  const [filtroStatus, setFiltroStatus] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(FILTER_KEY) ?? "";
    }
    return "";
  });
  const [pendentesBusca, setPendentesBusca] = useState("");
  const [pendentesExpandido, setPendentesExpandido] = useState(false);
  const [pendentes, setPendentes] = useState<ManutPendente[]>([]);
  const [descricao, setDescricao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resolvendoId, setResolvendoId] = useState<string | null>(null);
  const projetoSelecionado = useMemo(
    () => projetos.find((p) => p.id === projetoId),
    [projetos, projetoId]
  );
  const projetosFiltrados = useMemo(() => {
    const filtrados = searchItems(projetos, projetoBusca, [(p) => p.nome]);
    if (!projetoSelecionado) return filtrados;
    return [
      projetoSelecionado,
      ...filtrados.filter((p) => p.id !== projetoSelecionado.id),
    ];
  }, [projetos, projetoBusca, projetoSelecionado]);
  const pendentesFiltradas = useMemo(
    () =>
      searchItems(pendentes, pendentesBusca, [
        (m) => m.maquinas?.nome,
        (m) => m.maquinas?.identificador,
        (m) => m.equipes?.nome,
        (m) => m.projetos?.nome,
        (m) => m.talhao,
        (m) => m.descricao,
        (m) => m.status,
      ]),
    [pendentes, pendentesBusca]
  );
  const pendentesVisiveis = useMemo(
    () => visibleItems(pendentesFiltradas, pendentesExpandido, 10),
    [pendentesFiltradas, pendentesExpandido]
  );
  const maquinasFiltradas = useMemo(() => {
    const porStatus = items.filter((m) => !filtroStatus || m.status === filtroStatus);
    return searchItems(porStatus, maquinaBusca, [
      (m) => m.nome,
      (m) => m.tipo,
      (m) => m.identificador,
      (m) => m.status,
    ]);
  }, [items, filtroStatus, maquinaBusca]);
  const maquinasPicker = useMemo(() => {
    const selected = maquinaId ? maquinasFiltradas.find((m) => m.id === maquinaId) : undefined;
    if (!selected) return maquinasFiltradas;
    return [selected, ...maquinasFiltradas.filter((m) => m.id !== selected.id)];
  }, [maquinasFiltradas, maquinaId]);

  useEffect(() => {
    setItems(maquinas);
    setMaquinaId((atual) => atual || maquinas[0]?.id || "");
  }, [maquinas]);

  useEffect(() => {
    setEquipeId((atual) => atual || equipes[0]?.id || "");
  }, [equipes]);

  useEffect(() => {
    setProjetoId((atual) => atual || projetos[0]?.id || "");
  }, [projetos]);

  async function carregarPendentes() {
    const r = await fetch("/api/manutencoes?pendentes=1");
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) {
      toast(`Erro ao carregar pendências: ${j.error ?? r.statusText}`, "error");
      return;
    }
    setPendentes(Array.isArray(j.items) ? j.items : []);
  }

  useEffect(() => {
    carregarPendentes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setStatusMaquina(
      maquinaSelecionada?.status === "operando"
        ? "manutencao_urgente"
        : (maquinaSelecionada?.status ?? "manutencao_urgente")
    );
  }, [maquinaSelecionada]);

  function setFiltro(v: string) {
    setFiltroStatus(v);
    localStorage.setItem(FILTER_KEY, v);
  }

  function atualizarLocal(id: string, status: MachineStatus) {
    setItems((cur) => cur.map((m) => (m.id === id ? { ...m, status } : m)));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!maquinaId || !equipeId || !projetoId || !talhao.trim() || !descricao.trim()) {
      toast("Selecione máquina, frente, projeto, talhão e descreva o problema.", "error");
      return;
    }
    setEnviando(true);
    try {
      const r = await fetch("/api/manutencoes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          maquina_id: maquinaId,
          equipe_id: equipeId,
          projeto_id: projetoId,
          talhao: talhao.trim(),
          descricao,
          status_maquina: statusMaquina,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? "Falha ao reportar");
      }
      toast("Problema reportado para a manutenção.", "success");
      atualizarLocal(maquinaId, statusMaquina);
      await carregarPendentes();
      setTalhao("");
      setDescricao("");
    } catch (err) {
      toast(`Erro: ${(err as Error).message}`, "error");
    } finally {
      setEnviando(false);
    }
  }

  async function concluirManutencao(manut: ManutPendente) {
    setResolvendoId(manut.id);
    try {
      const r = await fetch(`/api/manutencoes/${manut.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "resolvido", status_maquina: "operando" }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) throw new Error(j.error ?? r.statusText);
      toast("Manutenção concluída.", "success");
      setPendentes((cur) => cur.filter((m) => m.id !== manut.id));
      if (j.machine_status) atualizarLocal(manut.maquina_id, j.machine_status);
    } catch (err) {
      toast(`Erro: ${(err as Error).message}`, "error");
    } finally {
      setResolvendoId(null);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      <MachinePicker
        maquinas={maquinasPicker}
        allMaquinas={items}
        selected={maquinaSelecionada}
        selectedId={maquinaId}
        busca={maquinaBusca}
        onBuscaChange={setMaquinaBusca}
        filtroStatus={filtroStatus}
        onFiltroStatusChange={setFiltro}
        onSelect={setMaquinaId}
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Select
          label="Frente / equipe"
          value={equipeId}
          onChange={(e) => setEquipeId(e.target.value)}
          options={equipes.map((e) => ({ value: e.id, label: e.nome }))}
          placeholder="Selecione…"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-bold text-[var(--color-ink-900)]">
          Status da máquina ao enviar
        </label>
        <div className="flex gap-2">
          {STATUS_OPTS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStatusMaquina(s.value)}
              className={
                "flex-1 rounded-xl border-2 py-2 text-xs font-bold transition " +
                (statusMaquina === s.value
                  ? "border-[var(--color-gn-500)] bg-[var(--color-gn-500)] text-white"
                  : "border-[var(--color-ink-300)] bg-white text-[var(--color-ink-800)]")
              }
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <ProjectPicker
        projetos={projetosFiltrados}
        selected={projetoSelecionado}
        selectedId={projetoId}
        busca={projetoBusca}
        onBuscaChange={setProjetoBusca}
        onSelect={setProjetoId}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-bold text-[var(--color-ink-900)]">
          Talhão
        </label>
        <input
          value={talhao}
          onChange={(e) => setTalhao(e.target.value)}
          className="h-13 min-h-12 rounded-xl border-2 border-[var(--color-ink-300)] bg-white px-3 text-base font-bold text-[var(--color-ink-900)] shadow-sm placeholder:font-bold placeholder:text-[var(--color-ink-700)] focus:border-[var(--color-gn-500)] outline-none transition"
          placeholder="Ex.: 017-01"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-bold text-[var(--color-ink-900)]">
          Descrição do problema
        </label>
        <textarea
          rows={4}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="rounded-xl border-2 border-[var(--color-ink-300)] bg-white px-3 py-2 text-base font-bold text-[var(--color-ink-900)] shadow-sm placeholder:font-bold placeholder:text-[var(--color-ink-700)] focus:border-[var(--color-gn-500)] outline-none"
          placeholder="Ex.: motor desligando em alta rotação, vazamento de óleo…"
        />
      </div>

      <Button type="submit" size="field" loading={enviando}>
        Reportar problema
      </Button>

      <div className="pt-2">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-bold text-[var(--color-ink-900)]">
            Manutenções pendentes
          </h3>
          <button
            type="button"
            onClick={carregarPendentes}
            className="text-xs font-bold text-[var(--color-gn-700)]"
          >
            atualizar
          </button>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2">
          <ListControls
            search={pendentesBusca}
            onSearchChange={setPendentesBusca}
            expanded={pendentesExpandido}
            onExpandedChange={setPendentesExpandido}
            total={pendentesFiltradas.length}
            visible={pendentesVisiveis.length}
            limit={10}
            label="Pesquisar pendência"
            placeholder="Máquina, frente, projeto, talhão ou problema"
          />
          {pendentesVisiveis.map((m) => (
            <Card key={m.id} className="p-3 space-y-3 border-red-200 bg-red-50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[var(--color-ink-900)]">
                    {m.maquinas?.nome ?? "Máquina"}
                    {m.maquinas?.identificador ? ` · ${m.maquinas.identificador}` : ""}
                  </p>
                  <p className="text-xs font-semibold text-[var(--color-ink-700)]">
                    {m.equipes?.nome ?? "Frente não informada"} · {m.projetos?.nome ?? "Projeto não informado"}
                    {m.talhao ? ` · Talhão ${m.talhao}` : ""}
                  </p>
                </div>
                <Badge tone={m.status === "aberto" ? "danger" : "warning"}>
                  {m.status.replaceAll("_", " ")}
                </Badge>
              </div>
              <p className="text-sm font-semibold text-[var(--color-ink-800)]">
                {m.descricao}
              </p>
              <p className="text-xs font-semibold text-[var(--color-ink-600)]">
                Aberta em {ddmmyyyy(m.created_at)}
              </p>
              <Button
                type="button"
                size="md"
                onClick={() => concluirManutencao(m)}
                loading={resolvendoId === m.id}
                className="w-full"
              >
                Concluir manutenção
              </Button>
            </Card>
          ))}
          {pendentesFiltradas.length === 0 && (
            <Card className="p-4 text-sm font-semibold text-[var(--color-ink-700)]">
              Nenhuma manutenção pendente neste filtro.
            </Card>
          )}
        </div>
      </div>
    </form>
  );
}
