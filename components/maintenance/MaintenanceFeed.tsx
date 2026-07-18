"use client";

/* eslint-disable @next/next/no-img-element -- signed URLs privadas do Supabase Storage. */

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { ddmmyyyy } from "@/lib/format";
import type {
  Equipe,
  MachineStatus,
  MaintenancePriority,
  ManutencaoEvento,
  ManutencaoThread,
  MentionableProfile,
  Maquina,
  Projeto,
  Talhao,
  UserRole,
} from "@/lib/types";

type MaintenanceFeedMode = "field" | "admin" | "gestor" | "manutencao";
type FeedFilter = "fila" | "meus" | "concluidos";

type MaintenanceFeedProps = {
  mode?: MaintenanceFeedMode;
  maquinas?: Maquina[];
  equipes?: Equipe[];
  projetos?: Array<Projeto & { talhoes?: Talhao[] }>;
  showComposer?: boolean;
  compact?: boolean;
  onChanged?: () => void;
};

const EMPTY_MACHINES: Maquina[] = [];
const EMPTY_TEAMS: Equipe[] = [];
const EMPTY_PROJECTS: Array<Projeto & { talhoes?: Talhao[] }> = [];

const MACHINE_STATUS_OPTIONS: { value: MachineStatus; label: string }[] = [
  { value: "operando", label: "Operando" },
  { value: "parada", label: "Parada" },
  { value: "manutencao_urgente", label: "Manutenção urgente" },
];

const PRIORITY_OPTIONS: { value: MaintenancePriority; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

const STATUS_LABEL = {
  aberto: "Aguardando manutenção",
  em_andamento: "Em atendimento",
  resolvido: "Resolvido",
} as const;

const EVENT_LABEL: Record<ManutencaoEvento["tipo"], string> = {
  criado: "Solicitação criada",
  atribuido: "Responsável definido",
  iniciado: "Serviço iniciado",
  prioridade_alterada: "Prioridade alterada",
  concluido: "Serviço concluído",
  status_maquina_alterado: "Status da máquina alterado",
  situacao_atualizada: "Situação atualizada",
};

function maintenanceDays(start: string, end?: string | null) {
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : Date.now();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return 0;
  return Math.max(0, Math.floor((endTime - startTime) / 86_400_000));
}

function statusTone(status: ManutencaoThread["status"]) {
  if (status === "resolvido") return "success" as const;
  if (status === "em_andamento") return "warning" as const;
  return "danger" as const;
}

function priorityTone(priority: MaintenancePriority) {
  if (priority === "urgente") return "danger" as const;
  if (priority === "alta") return "warning" as const;
  return "neutral" as const;
}

function roleLabel(role: UserRole) {
  if (role === "admin") return "Admin";
  if (role === "gestor") return "Gestor";
  if (role === "manutencao") return "Manutenção";
  return "Encarregado";
}

async function readJson<T>(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  const json = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok || json.error) throw new Error(json.error ?? response.statusText);
  return json;
}

function MentionPicker({
  people,
  selectedIds,
  currentUserId,
  onChange,
}: {
  people: MentionableProfile[];
  selectedIds: string[];
  currentUserId: string | null;
  onChange: (ids: string[]) => void;
}) {
  const available = people.filter((person) => person.id !== currentUserId);
  return (
    <div className="grid max-h-48 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
      {available.map((person) => {
        const active = selectedIds.includes(person.id);
        return (
          <button
            key={person.id}
            type="button"
            onClick={() =>
              onChange(
                active
                  ? selectedIds.filter((id) => id !== person.id)
                  : [...selectedIds, person.id]
              )
            }
            className="min-h-10 rounded-lg border px-3 text-left text-xs font-bold"
            style={{
              background: active ? "var(--accent-subtle)" : "var(--bg-card-alt)",
              borderColor: active ? "var(--accent)" : "var(--border)",
              color: "var(--text-primary)",
            }}
          >
            <span className="block truncate">{person.nome}</span>
            <span className="block truncate font-semibold text-[var(--text-muted)]">
              {roleLabel(person.role)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function contextText(thread: ManutencaoThread) {
  return [
    thread.maquinas?.tipo,
    thread.equipes?.nome,
    thread.projetos?.nome,
    thread.talhao ? `Talhão ${thread.talhao}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function eventDetail(event: ManutencaoEvento) {
  if (event.tipo === "atribuido") return String(event.dados.responsavel_nome ?? "");
  if (event.tipo === "prioridade_alterada") return String(event.dados.prioridade ?? "");
  if (event.tipo === "status_maquina_alterado") return String(event.dados.novo ?? "");
  if (event.tipo === "situacao_atualizada") return String(event.dados.novo ?? "");
  return "";
}

export default function MaintenanceFeed({
  mode = "field",
  maquinas: initialMaquinas = EMPTY_MACHINES,
  equipes: initialEquipes = EMPTY_TEAMS,
  projetos: initialProjetos = EMPTY_PROJECTS,
  showComposer = true,
  compact = false,
  onChanged,
}: MaintenanceFeedProps) {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [threads, setThreads] = useState<ManutencaoThread[]>([]);
  const [maquinas, setMaquinas] = useState<Maquina[]>(initialMaquinas);
  const [equipes, setEquipes] = useState<Equipe[]>(initialEquipes);
  const [projetos, setProjetos] = useState<Array<Projeto & { talhoes?: Talhao[] }>>(initialProjetos);
  const [mentionables, setMentionables] = useState<MentionableProfile[]>([]);
  const [technicians, setTechnicians] = useState<MentionableProfile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [filter, setFilter] = useState<FeedFilter>("fila");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentMentions, setCommentMentions] = useState<Record<string, string[]>>({});
  const [completion, setCompletion] = useState({ relato: "", status: "operando" as MachineStatus });
  const [situationDraft, setSituationDraft] = useState("");
  const [form, setForm] = useState({
    maquina_id: initialMaquinas[0]?.id ?? "",
    equipe_id: initialEquipes[0]?.id ?? "",
    projeto_id: initialProjetos[0]?.id ?? "",
    talhao_id: "",
    talhao: "",
    descricao: "",
    status_maquina: "manutencao_urgente" as MachineStatus,
  });
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    try {
      const json = await readJson<{
        items: ManutencaoThread[];
        current_user?: { id: string; role: UserRole };
      }>("/api/manutencoes");
      setThreads(Array.isArray(json.items) ? json.items : []);
      setCurrentUserId(json.current_user?.id ?? null);
      setCurrentRole(json.current_user?.role ?? null);
    } catch (error) {
      toast(`Erro ao carregar manutenção: ${(error as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadOptions = useCallback(async () => {
    try {
      const [machineData, teamData, projectData, peopleData] = await Promise.all([
        initialMaquinas.length
          ? Promise.resolve({ items: initialMaquinas })
          : readJson<{ items: Maquina[] }>("/api/maquinas"),
        initialEquipes.length || !showComposer
          ? Promise.resolve({ items: initialEquipes })
          : readJson<{ items: Equipe[] }>("/api/equipes"),
        !showComposer
          ? Promise.resolve({ items: initialProjetos })
          : readJson<{ items: Array<Projeto & { talhoes?: Talhao[] }> }>("/api/projetos?include_talhoes=1"),
        readJson<{ items: MentionableProfile[] }>("/api/manutencoes/mentionables"),
      ]);
      setMaquinas(machineData.items ?? []);
      setEquipes(teamData.items ?? []);
      setProjetos(projectData.items ?? []);
      setMentionables(peopleData.items ?? []);
      setTechnicians((peopleData.items ?? []).filter((person) => person.role === "manutencao"));
    } catch (error) {
      toast(`Erro ao carregar opções: ${(error as Error).message}`, "error");
    }
  }, [initialEquipes, initialMaquinas, initialProjetos, showComposer, toast]);

  useEffect(() => {
    void loadThreads();
    void loadOptions();
    const timer = window.setInterval(() => void loadThreads(), 30000);
    return () => window.clearInterval(timer);
  }, [loadOptions, loadThreads]);

  useEffect(() => {
    const requestedId = searchParams.get("chamado");
    if (requestedId && threads.some((thread) => thread.id === requestedId)) setSelectedId(requestedId);
  }, [searchParams, threads]);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      maquina_id: current.maquina_id || maquinas[0]?.id || "",
      equipe_id: current.equipe_id || equipes[0]?.id || "",
      projeto_id: current.projeto_id || projetos[0]?.id || "",
    }));
  }, [equipes, maquinas, projetos]);

  const selected = threads.find((thread) => thread.id === selectedId) ?? null;
  const availablePlots = useMemo(
    () => projetos.find((item) => item.id === form.projeto_id)?.talhoes?.filter((item) => item.ativo) ?? [],
    [form.projeto_id, projetos]
  );
  const pending = threads.filter((thread) => thread.status !== "resolvido");
  const showCreate = showComposer && currentRole !== "manutencao";
  const filteredThreads = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return threads.filter((thread) => {
      if (filter === "fila" && thread.status === "resolvido") return false;
      if (filter === "concluidos" && thread.status !== "resolvido") return false;
      if (
        filter === "meus" &&
        thread.responsavel_id !== currentUserId &&
        thread.reportado_por !== currentUserId
      ) return false;
      if (!normalized) return true;
      return [
        thread.descricao,
        thread.maquinas?.nome,
        thread.maquinas?.identificador,
        thread.responsavel?.nome,
      ].some((value) => value?.toLowerCase().includes(normalized));
    });
  }, [currentUserId, filter, query, threads]);

  useEffect(() => {
    if (!showCreate || !form.maquina_id) return;
    let active = true;
    fetch(`/api/alocacoes?maquina_id=${encodeURIComponent(form.maquina_id)}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((json) => {
        const allocation = json?.items?.[0];
        if (!active || !allocation?.projeto_id || !allocation?.talhao_id) return;
        setForm((current) => ({
          ...current,
          projeto_id: allocation.projeto_id,
          talhao_id: allocation.talhao_id,
          talhao: allocation.talhoes?.codigo ?? current.talhao,
        }));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [form.maquina_id, showCreate]);

  async function runAction(
    thread: ManutencaoThread,
    action: "assumir" | "atribuir" | "iniciar" | "priorizar" | "concluir" | "atualizar_situacao",
    extra: Record<string, unknown> = {}
  ) {
    setBusyId(thread.id);
    try {
      const response = await fetch(`/api/manutencoes/${thread.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok || json.error) throw new Error(json.error ?? response.statusText);
      toast(action === "concluir" ? "Serviço concluído." : action === "atualizar_situacao" ? "Situação atualizada." : "Solicitação atualizada.", "success");
      if (action === "concluir") setCompletion({ relato: "", status: "operando" });
      if (action === "atualizar_situacao") setSituationDraft("");
      await loadThreads();
      onChanged?.();
    } catch (error) {
      toast(`Erro: ${(error as Error).message}`, "error");
    } finally {
      setBusyId(null);
    }
  }

  async function submitComment(thread: ManutencaoThread) {
    const texto = (commentDrafts[thread.id] ?? "").trim();
    if (!texto) return toast("Escreva um comentário.", "error");
    setBusyId(thread.id);
    try {
      const response = await fetch(`/api/manutencoes/${thread.id}/comentarios`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ texto, mention_ids: commentMentions[thread.id] ?? [] }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok || json.error) throw new Error(json.error ?? response.statusText);
      setCommentDrafts((current) => ({ ...current, [thread.id]: "" }));
      setCommentMentions((current) => ({ ...current, [thread.id]: [] }));
      await loadThreads();
    } catch (error) {
      toast(`Erro: ${(error as Error).message}`, "error");
    } finally {
      setBusyId(null);
    }
  }

  async function submitRequest(event: FormEvent) {
    event.preventDefault();
    if (!form.maquina_id || !form.equipe_id || !form.projeto_id || !form.talhao_id || !form.descricao.trim()) {
      return toast("Preencha máquina, equipe, projeto, talhão e descrição.", "error");
    }
    if (photos.length > 3 || photos.some((file) => file.size > 6 * 1024 * 1024)) {
      return toast("Envie até 3 fotos com no máximo 6MB cada.", "error");
    }
    setSubmitting(true);
    try {
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) => data.set(key, value));
      data.set("mention_ids", JSON.stringify(mentionIds));
      photos.forEach((photo) => data.append("photos", photo));
      const response = await fetch("/api/manutencoes", { method: "POST", body: data });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok || json.error) throw new Error(json.error ?? response.statusText);
      setForm((current) => ({ ...current, talhao_id: "", talhao: "", descricao: "" }));
      setMentionIds([]);
      setPhotos([]);
      toast("Solicitação criada.", "success");
      await loadThreads();
      onChanged?.();
    } catch (error) {
      toast(`Erro: ${(error as Error).message}`, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function openThread(thread: ManutencaoThread) {
    setSelectedId(thread.id);
    if (thread.unread_mentions_count > 0) {
      await fetch("/api/manutencoes/mencoes/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ manutencao_id: thread.id }),
      }).catch(() => null);
    }
  }

  const title = mode === "manutencao" ? "Solicitações" : "Manutenção";

  return (
    <section className={`space-y-5 ${compact ? "pb-2" : "pb-8"}`}>
      {!compact && (
        <PageHeader
          eyebrow="Manutenção"
          title={title}
          subtitle={`${pending.length} pendente${pending.length === 1 ? "" : "s"}`}
          right={
            <Button variant="secondary" size="sm" onClick={() => void loadThreads()} loading={loading}>
              Atualizar
            </Button>
          }
        />
      )}

      {showCreate && (
        <details className="group rounded-lg border border-[var(--border)] bg-[var(--bg-card)]">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-sm font-semibold text-[var(--text-primary)]">
            <span>Nova solicitação</span>
            <span className="text-xl font-normal text-[var(--accent)] group-open:rotate-45">+</span>
          </summary>
          <form onSubmit={submitRequest} className="space-y-4 border-t border-[var(--border)] p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Select label="Máquina" value={form.maquina_id} onChange={(e) => setForm({ ...form, maquina_id: e.target.value })} options={maquinas.map((item) => ({ value: item.id, label: `${item.nome}${item.identificador ? ` · ${item.identificador}` : ""}` }))} placeholder="Selecione" />
              <Select label="Situação da máquina" value={form.status_maquina} onChange={(e) => setForm({ ...form, status_maquina: e.target.value as MachineStatus })} options={MACHINE_STATUS_OPTIONS} />
              <Select label="Equipe" value={form.equipe_id} onChange={(e) => setForm({ ...form, equipe_id: e.target.value })} options={equipes.map((item) => ({ value: item.id, label: item.nome }))} placeholder="Selecione" />
              <Select label="Projeto" value={form.projeto_id} onChange={(e) => setForm({ ...form, projeto_id: e.target.value, talhao_id: "", talhao: "" })} options={projetos.map((item) => ({ value: item.id, label: item.nome }))} placeholder="Selecione" />
            </div>
            <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
              <Select label="Talhão" value={form.talhao_id} onChange={(e) => { const plot = availablePlots.find((item) => item.id === e.target.value); setForm({ ...form, talhao_id: plot?.id ?? "", talhao: plot?.codigo ?? "" }); }} options={availablePlots.map((item) => ({ value: item.id, label: item.area_ha == null ? item.codigo : `${item.codigo} · ${Number(item.area_ha).toLocaleString("pt-BR")} ha` }))} placeholder={form.projeto_id ? "Selecione" : "Projeto primeiro"} />
              <label className="text-xs font-bold uppercase text-[var(--text-muted)]">Problema<textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="mt-1 min-h-24 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-sm font-semibold normal-case text-[var(--text-primary)]" placeholder="Descreva o defeito ou sintoma." /></label>
            </div>
            <details>
              <summary className="cursor-pointer text-xs font-bold text-[var(--accent)]">Fotos e pessoas marcadas</summary>
              <div className="mt-3 space-y-3">
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setPhotos(Array.from(e.target.files ?? []).slice(0, 3))} className="w-full rounded-lg border border-[var(--border)] p-3 text-sm" />
                <MentionPicker people={mentionables} selectedIds={mentionIds} currentUserId={currentUserId} onChange={setMentionIds} />
              </div>
            </details>
            <div className="flex justify-end"><Button type="submit" loading={submitting}>Criar solicitação</Button></div>
          </form>
        </details>
      )}

      {!compact && <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="inline-flex overflow-x-auto border-b border-[var(--divider)]">
          {([
            ["fila", "Fila", pending.length],
            ["meus", mode === "manutencao" ? "Meus serviços" : "Meus", threads.filter((item) => item.responsavel_id === currentUserId || item.reportado_por === currentUserId).length],
            ["concluidos", "Concluídos", threads.filter((item) => item.status === "resolvido").length],
          ] as const).map(([key, label, count]) => (
            <button key={key} type="button" onClick={() => setFilter(key)} className="min-h-10 border-b-2 px-3 text-xs font-medium" style={{ borderColor: filter === key ? "var(--accent)" : "transparent", background: "transparent", color: filter === key ? "var(--accent)" : "var(--text-muted)" }}>
              {label} <span className="ml-1 opacity-70">{count}</span>
            </button>
          ))}
        </div>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar máquina ou chamado" className="h-11 rounded-md border border-[var(--border)] bg-[var(--bg-input)] px-3 text-sm font-normal text-[var(--text-primary)] sm:w-72" />
      </div>}

      {loading && threads.length === 0 ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-8 text-center text-sm font-semibold text-[var(--text-muted)]">Carregando solicitações...</div>
      ) : filteredThreads.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-sm font-semibold text-[var(--text-muted)]">Nenhuma solicitação neste filtro.</div>
      ) : (
        <div className="grid gap-1.5">
          {filteredThreads.map((thread) => (
            <button key={thread.id} type="button" onClick={() => void openThread(thread)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3.5 text-left transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone={priorityTone(thread.prioridade)}>{thread.prioridade}</Badge>
                    <Badge tone={statusTone(thread.status)}>{STATUS_LABEL[thread.status]}</Badge>
                    {thread.status !== "resolvido" && <Badge tone="danger">{maintenanceDays(thread.parada_desde ?? thread.created_at)} dias parada</Badge>}
                    {thread.unread_mentions_count > 0 && <Badge tone="info">nova menção</Badge>}
                  </div>
                  <h3 className="mt-2 truncate text-sm font-semibold text-[var(--text-primary)] sm:text-base">
                    {thread.maquinas?.nome ?? "Máquina removida"}
                    {thread.maquinas?.identificador ? ` · ${thread.maquinas.identificador}` : ""}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm font-normal text-[var(--text-secondary)]">{thread.descricao}</p>
                  <p className="mt-2 line-clamp-1 text-xs font-medium text-[var(--text-primary)]">Status atual: {thread.situacao_atual}</p>
                  <p className="mt-2 truncate text-xs font-normal text-[var(--text-muted)]">
                    {thread.responsavel ? `Responsável: ${thread.responsavel.nome}` : "Sem responsável"} · {ddmmyyyy(thread.created_at)}
                  </p>
                </div>
                <span className="mt-1 text-xl text-[var(--text-muted)]">›</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-[70] bg-black/45" onClick={() => setSelectedId(null)}>
          <aside className="ml-auto h-full w-full overflow-y-auto border-l border-[var(--border)] bg-[var(--bg-page)] shadow-2xl sm:max-w-xl" onClick={(event) => event.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-card)] px-4 py-3">
              <div className="min-w-0"><p className="text-xs font-medium text-[var(--text-muted)]">Solicitação</p><h2 className="truncate text-lg font-semibold text-[var(--text-primary)]">{selected.maquinas?.nome ?? "Máquina"}</h2></div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>Fechar</Button>
            </div>
            <div className="space-y-4 p-4 sm:p-5">
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4">
                <div className="flex flex-wrap gap-2"><Badge tone={priorityTone(selected.prioridade)}>{selected.prioridade}</Badge><Badge tone={statusTone(selected.status)}>{STATUS_LABEL[selected.status]}</Badge></div>
                <p className="mt-3 text-sm font-normal leading-relaxed text-[var(--text-primary)]">{selected.descricao}</p>
                <p className="mt-3 text-xs font-normal text-[var(--text-muted)]">{contextText(selected)}</p>
                <p className="mt-1 text-xs font-normal text-[var(--text-muted)]">Aberto por {selected.autor?.nome ?? "Usuário"} em {ddmmyyyy(selected.created_at)}</p>
                <p className="mt-2 text-sm font-semibold text-[var(--danger)]">Máquina parada há {maintenanceDays(selected.parada_desde ?? selected.created_at, selected.parada_ate)} dias</p>
              </div>

              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4">
                <p className="text-xs font-medium text-[var(--text-muted)]">Status atual da máquina</p>
                <p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-[var(--text-primary)]">{selected.situacao_atual}</p>
                <p className="mt-2 text-[11px] text-[var(--text-muted)]">Atualizado em {ddmmyyyy(selected.situacao_atualizada_em)}</p>
                {selected.can_update_situation && (
                  <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-4">
                    <label className="block text-xs font-medium text-[var(--text-muted)]">Nova atualização<textarea value={situationDraft} onChange={(event) => setSituationDraft(event.target.value.slice(0, 500))} maxLength={500} className="mt-1 min-h-20 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]" placeholder="Ex.: Aguardando liberação da compra da peça." /></label>
                    <div className="flex justify-end"><Button size="sm" loading={busyId === selected.id} disabled={situationDraft.trim().length < 3} onClick={() => void runAction(selected, "atualizar_situacao", { situacao_atual: situationDraft })}>Atualizar status</Button></div>
                  </div>
                )}
              </div>

              {(selected.can_assign || selected.can_prioritize) && (
                <div className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:grid-cols-2">
                  {selected.can_prioritize && <Select label="Prioridade" value={selected.prioridade} onChange={(e) => void runAction(selected, "priorizar", { prioridade: e.target.value })} options={PRIORITY_OPTIONS} />}
                  {selected.can_assign && <Select label="Responsável" value={selected.responsavel_id ?? ""} onChange={(e) => e.target.value && void runAction(selected, "atribuir", { responsavel_id: e.target.value })} options={technicians.map((item) => ({ value: item.id, label: item.nome }))} placeholder="Sem responsável" />}
                </div>
              )}

              {selected.status !== "resolvido" && (selected.can_claim || selected.can_start || selected.can_resolve) && (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4">
                  <div className="flex flex-wrap gap-2">
                    {selected.can_claim && selected.status === "aberto" && <Button loading={busyId === selected.id} onClick={() => void runAction(selected, "assumir")}>Assumir e iniciar</Button>}
                    {selected.can_start && <Button loading={busyId === selected.id} onClick={() => void runAction(selected, "iniciar")}>Iniciar serviço</Button>}
                  </div>
                  {selected.can_resolve && (
                    <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
                      <label className="block text-xs font-bold uppercase text-[var(--text-muted)]">Serviço realizado<textarea value={completion.relato} onChange={(e) => setCompletion({ ...completion, relato: e.target.value })} className="mt-1 min-h-24 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-sm font-semibold normal-case text-[var(--text-primary)]" /></label>
                      <Select label="Status final da máquina" value={completion.status} onChange={(e) => setCompletion({ ...completion, status: e.target.value as MachineStatus })} options={MACHINE_STATUS_OPTIONS} />
                      <Button className="w-full" loading={busyId === selected.id} disabled={completion.relato.trim().length < 3} onClick={() => void runAction(selected, "concluir", { relato_conclusao: completion.relato, status_maquina: completion.status })}>Concluir serviço</Button>
                    </div>
                  )}
                </div>
              )}

              {selected.relato_conclusao && <div className="rounded-lg border border-[var(--success)] bg-[var(--success-bg)] p-4"><p className="text-xs font-bold uppercase text-[var(--success)]">Serviço realizado</p><p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-[var(--text-primary)]">{selected.relato_conclusao}</p></div>}

              {selected.anexos.length > 0 && <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{selected.anexos.map((anexo) => <a key={anexo.id} href={anexo.url ?? "#"} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)]">{anexo.url ? <img src={anexo.url} alt={anexo.file_name} className="h-32 w-full object-cover" /> : <span className="grid h-32 place-items-center text-xs text-[var(--text-muted)]">Foto indisponível</span>}</a>)}</div>}

              {(selected.eventos.length > 0 || selected.comentarios.length > 0) && <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4"><h3 className="text-sm font-bold text-[var(--text-primary)]">Histórico</h3><div className="mt-3 space-y-3">{selected.eventos.map((event) => <div key={event.id} className="border-l-2 border-[var(--border)] pl-3"><p className="text-xs font-bold text-[var(--text-primary)]">{EVENT_LABEL[event.tipo]}{eventDetail(event) ? ` · ${eventDetail(event)}` : ""}</p><p className="text-[11px] font-semibold text-[var(--text-muted)]">{event.ator?.nome ?? "Sistema"} · {ddmmyyyy(event.created_at)}</p></div>)}{selected.comentarios.map((comment) => <div key={comment.id} className="border-l-2 border-[var(--accent)] pl-3"><p className="text-xs font-bold text-[var(--text-primary)]">{comment.autor?.nome ?? "Usuário"}</p><p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-[var(--text-secondary)]">{comment.texto}</p><p className="mt-1 text-[11px] text-[var(--text-muted)]">{ddmmyyyy(comment.created_at)}</p></div>)}</div></div>}

              {selected.can_comment && <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4"><textarea value={commentDrafts[selected.id] ?? ""} onChange={(e) => setCommentDrafts((current) => ({ ...current, [selected.id]: e.target.value }))} className="min-h-20 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)]" placeholder="Adicionar comentário" /><details><summary className="cursor-pointer text-xs font-bold text-[var(--accent)]">Marcar alguém</summary><div className="mt-2"><MentionPicker people={mentionables} selectedIds={commentMentions[selected.id] ?? []} currentUserId={currentUserId} onChange={(ids) => setCommentMentions((current) => ({ ...current, [selected.id]: ids }))} /></div></details><div className="flex justify-end"><Button size="sm" loading={busyId === selected.id} onClick={() => void submitComment(selected)}>Comentar</Button></div></div>}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
