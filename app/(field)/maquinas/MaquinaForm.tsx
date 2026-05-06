"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
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
  const [filtroStatus, setFiltroStatus] = useState("");
  const [frotaBusca, setFrotaBusca] = useState("");
  const [frotaExpandida, setFrotaExpandida] = useState(false);
  const [pendentesBusca, setPendentesBusca] = useState("");
  const [pendentesExpandido, setPendentesExpandido] = useState(false);
  const [pendentes, setPendentes] = useState<ManutPendente[]>([]);
  const [descricao, setDescricao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resolvendoId, setResolvendoId] = useState<string | null>(null);
  const maquinaOptions = useMemo(() => {
    const filtradas = searchItems(items, maquinaBusca, [
      (m) => m.nome,
      (m) => m.tipo,
      (m) => m.identificador,
      (m) => m.status,
    ]);
    const selected = maquinaId ? items.find((m) => m.id === maquinaId) : undefined;
    return selected && !filtradas.some((m) => m.id === selected.id)
      ? [selected, ...filtradas]
      : filtradas;
  }, [items, maquinaBusca, maquinaId]);
  const projetoOptions = useMemo(() => {
    const filtrados = searchItems(projetos, projetoBusca, [(p) => p.nome]);
    const selected = projetoId ? projetos.find((p) => p.id === projetoId) : undefined;
    return selected && !filtrados.some((p) => p.id === selected.id)
      ? [selected, ...filtrados]
      : filtrados;
  }, [projetos, projetoBusca, projetoId]);
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
    return searchItems(porStatus, frotaBusca, [
      (m) => m.nome,
      (m) => m.tipo,
      (m) => m.identificador,
      (m) => m.status,
    ]);
  }, [items, filtroStatus, frotaBusca]);
  const maquinasVisiveis = useMemo(
    () => visibleItems(maquinasFiltradas, frotaExpandida, 20),
    [maquinasFiltradas, frotaExpandida]
  );

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

  function atualizarLocal(id: string, status: MachineStatus) {
    setItems((cur) => cur.map((m) => (m.id === id ? { ...m, status } : m)));
  }

  async function alterarStatus(id: string, status: MachineStatus) {
    const r = await fetch(`/api/maquinas/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast(`Erro ao alterar status: ${j.error ?? r.statusText}`, "error");
      return;
    }
    atualizarLocal(id, status);
    toast("Status da máquina atualizado.", "success");
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
      <Input
        label="Buscar máquina"
        type="search"
        value={maquinaBusca}
        onChange={(e) => setMaquinaBusca(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
        placeholder="Código, tipo ou status"
      />
      <Select
        label="Máquina"
        value={maquinaId}
        onChange={(e) => setMaquinaId(e.target.value)}
        options={maquinaOptions.map((m) => ({
          value: m.id,
          label: m.identificador ? `${m.nome} · ${m.identificador}` : m.nome,
        }))}
        placeholder="Selecione…"
      />

      <Select
        label="Novo status"
        value={statusMaquina}
        onChange={(e) => setStatusMaquina(e.target.value as MachineStatus)}
        options={STATUS_OPTS}
      />

      <Select
        label="Frente / equipe"
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
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
        placeholder="Digite parte da fazenda/projeto"
      />

      <Select
        label="Projeto"
        value={projetoId}
        onChange={(e) => setProjetoId(e.target.value)}
        options={projetoOptions.map((p) => ({ value: p.id, label: p.nome }))}
        placeholder="Selecione…"
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

      <div className="pt-2">
        <h3 className="text-sm font-bold text-[var(--color-ink-900)]">
          Status atual da frota
        </h3>
        <div className="mt-2">
          <ListControls
            search={frotaBusca}
            onSearchChange={setFrotaBusca}
            expanded={frotaExpandida}
            onExpandedChange={setFrotaExpandida}
            total={maquinasFiltradas.length}
            visible={maquinasVisiveis.length}
            label="Pesquisar frota"
            placeholder="Código, tipo ou status"
          >
            <Select
              label="Filtro de status"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              options={STATUS_OPTS}
              placeholder="Todos"
            />
          </ListControls>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2">
          {maquinasVisiveis.map((m) => (
            <Card key={m.id} className="p-3 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">{m.nome}</p>
                  <p className="text-xs font-semibold text-[var(--color-ink-500)]">
                    {m.tipo}
                    {m.identificador ? ` · ${m.identificador}` : ""}
                  </p>
                </div>
                {m.status === "operando" ? (
                  <Badge tone="success">operando</Badge>
                ) : m.status === "parada" ? (
                  <Badge tone="warning">parada</Badge>
                ) : (
                  <Badge tone="danger">manutenção urgente</Badge>
                )}
              </div>
              <select
                value={m.status}
                onChange={(e) => alterarStatus(m.id, e.target.value as MachineStatus)}
                className="h-11 w-full rounded-lg border-2 border-[var(--color-ink-300)] bg-white px-3 text-sm font-bold text-[var(--color-ink-900)] shadow-sm"
              >
                {STATUS_OPTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Card>
          ))}
          {maquinasFiltradas.length === 0 && (
            <Card className="p-4 text-sm font-semibold text-[var(--color-ink-700)]">
              Nenhuma máquina neste filtro.
            </Card>
          )}
        </div>
      </div>
    </form>
  );
}
