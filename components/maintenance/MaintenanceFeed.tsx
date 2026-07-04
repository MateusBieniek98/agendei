"use client";

/* eslint-disable @next/next/no-img-element -- fotos vêm de signed URLs privadas do Supabase Storage. */

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { ddmmyyyy } from "@/lib/format";
import type {
  Equipe,
  MachineStatus,
  MaintenanceStatus,
  ManutencaoThread,
  MentionableProfile,
  Maquina,
  Projeto,
  UserRole,
} from "@/lib/types";

type MaintenanceFeedMode = "field" | "admin" | "gestor";
type FeedFilter = "todos" | "meus" | "mencionados" | "pendentes";

type MaintenanceFeedProps = {
  mode?: MaintenanceFeedMode;
  maquinas?: Maquina[];
  equipes?: Equipe[];
  projetos?: Projeto[];
  showComposer?: boolean;
  compact?: boolean;
  onChanged?: () => void;
};

const MACHINE_STATUS_OPTIONS: { value: MachineStatus; label: string }[] = [
  { value: "operando", label: "Operando" },
  { value: "parada", label: "Parada" },
  { value: "manutencao_urgente", label: "Manutenção urgente" },
];

const STATUS_META: Record<MaintenanceStatus, { label: string; color: string; bg: string }> = {
  aberto: {
    label: "Aberto",
    color: "var(--danger)",
    bg: "var(--danger-bg)",
  },
  em_andamento: {
    label: "Em andamento",
    color: "var(--warn)",
    bg: "var(--warn-bg)",
  },
  resolvido: {
    label: "Resolvido",
    color: "var(--success)",
    bg: "var(--success-bg)",
  },
};

function roleLabel(role: UserRole) {
  if (role === "admin") return "Admin";
  if (role === "gestor") return "Gestor";
  return "Encarregado";
}

function compactName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return name;
  return `${parts[0]} ${parts[parts.length - 1]}`;
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
  label,
}: {
  people: MentionableProfile[];
  selectedIds: string[];
  currentUserId: string | null;
  onChange: (ids: string[]) => void;
  label: string;
}) {
  const [query, setQuery] = useState("");
  const selected = people.filter((person) => selectedIds.includes(person.id));
  const filtered = people
    .filter((person) => person.id !== currentUserId)
    .filter((person) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        person.nome.toLowerCase().includes(q) ||
        person.role.toLowerCase().includes(q) ||
        (person.equipes?.nome ?? "").toLowerCase().includes(q)
      );
    })
    .slice(0, 8);

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id]
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>
        {label}
      </label>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => toggle(person.id)}
              className="rounded-full border px-2.5 py-1 text-xs font-black"
              style={{
                background: "var(--accent-subtle)",
                borderColor: "var(--accent)",
                color: "var(--accent)",
              }}
            >
              @{compactName(person.nome)} ×
            </button>
          ))}
        </div>
      )}

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar pessoa para marcar"
        className="h-11 w-full rounded-xl border px-3 text-sm font-bold outline-none"
        style={{
          background: "var(--bg-input, var(--bg-card))",
          borderColor: "var(--border)",
          color: "var(--text-primary)",
        }}
      />

      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed p-3 text-xs font-semibold" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
            Nenhuma pessoa disponível.
          </p>
        ) : (
          filtered.map((person) => {
            const active = selectedIds.includes(person.id);
            return (
              <button
                key={person.id}
                type="button"
                onClick={() => toggle(person.id)}
                className="min-h-12 rounded-xl border px-3 text-left transition active:scale-[0.99]"
                style={{
                  background: active ? "var(--accent-subtle)" : "var(--bg-card-alt)",
                  borderColor: active ? "var(--accent)" : "var(--border)",
                }}
              >
                <span className="block truncate text-sm font-black" style={{ color: "var(--text-primary)" }}>
                  {person.nome}
                </span>
                <span className="block truncate text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
                  {roleLabel(person.role)}
                  {person.equipes?.nome ? ` · ${person.equipes.nome}` : ""}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function ThreadContext({ thread }: { thread: ManutencaoThread }) {
  const items = [
    thread.maquinas?.nome,
    thread.maquinas?.identificador,
    thread.equipes?.nome,
    thread.projetos?.nome,
    thread.talhao ? `Talhão ${thread.talhao}` : null,
  ].filter(Boolean);

  return (
    <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
      {items.join(" · ") || "Sem contexto operacional"}
    </p>
  );
}

export default function MaintenanceFeed({
  mode = "field",
  maquinas: initialMaquinas = [],
  equipes: initialEquipes = [],
  projetos: initialProjetos = [],
  showComposer = true,
  compact = false,
  onChanged,
}: MaintenanceFeedProps) {
  const { toast } = useToast();
  const [threads, setThreads] = useState<ManutencaoThread[]>([]);
  const [maquinas, setMaquinas] = useState<Maquina[]>(initialMaquinas);
  const [equipes, setEquipes] = useState<Equipe[]>(initialEquipes);
  const [projetos, setProjetos] = useState<Projeto[]>(initialProjetos);
  const [mentionables, setMentionables] = useState<MentionableProfile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FeedFilter>("pendentes");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [commentingId, setCommentingId] = useState<string | null>(null);
  const [managingId, setManagingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    maquina_id: initialMaquinas[0]?.id ?? "",
    equipe_id: initialEquipes[0]?.id ?? "",
    projeto_id: initialProjetos[0]?.id ?? "",
    talhao: "",
    descricao: "",
    status_maquina: "manutencao_urgente" as MachineStatus,
  });
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentMentions, setCommentMentions] = useState<Record<string, string[]>>({});

  const loadThreads = useCallback(async () => {
    setLoading(true);
    try {
      const json = await readJson<{
        items: ManutencaoThread[];
        current_user?: { id: string; role: UserRole };
      }>("/api/manutencoes");
      setThreads(Array.isArray(json.items) ? json.items : []);
      setCurrentUserId(json.current_user?.id ?? null);
    } catch (err) {
      toast(`Erro ao carregar manutenção: ${(err as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadOptions = useCallback(async () => {
    try {
      const [maquinasJson, equipesJson, projetosJson, mentionablesJson] = await Promise.all([
        initialMaquinas.length > 0
          ? Promise.resolve({ items: initialMaquinas })
          : readJson<{ items: Maquina[] }>("/api/maquinas"),
        initialEquipes.length > 0
          ? Promise.resolve({ items: initialEquipes })
          : readJson<{ items: Equipe[] }>("/api/equipes"),
        initialProjetos.length > 0
          ? Promise.resolve({ items: initialProjetos })
          : readJson<{ items: Projeto[] }>("/api/projetos"),
        readJson<{ items: MentionableProfile[] }>("/api/manutencoes/mentionables"),
      ]);
      setMaquinas(maquinasJson.items ?? []);
      setEquipes(equipesJson.items ?? []);
      setProjetos(projetosJson.items ?? []);
      setMentionables(mentionablesJson.items ?? []);
    } catch (err) {
      toast(`Erro ao carregar opções: ${(err as Error).message}`, "error");
    }
  }, [initialEquipes, initialMaquinas, initialProjetos, toast]);

  useEffect(() => {
    void loadThreads();
    void loadOptions();
    const timer = window.setInterval(() => {
      void loadThreads();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [loadOptions, loadThreads]);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      maquina_id: current.maquina_id || maquinas[0]?.id || "",
      equipe_id: current.equipe_id || equipes[0]?.id || "",
      projeto_id: current.projeto_id || projetos[0]?.id || "",
    }));
  }, [equipes, maquinas, projetos]);

  useEffect(() => {
    const urls = photos.map((file) => URL.createObjectURL(file));
    setPhotoPreviews(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photos]);

  const filteredThreads = useMemo(() => {
    return threads.filter((thread) => {
      if (filter === "pendentes") return thread.status !== "resolvido";
      if (filter === "meus") return thread.reportado_por === currentUserId;
      if (filter === "mencionados") {
        return currentUserId ? thread.mentioned_profile_ids.includes(currentUserId) : false;
      }
      return true;
    });
  }, [currentUserId, filter, threads]);

  const unreadMentions = useMemo(
    () => threads.reduce((total, thread) => total + thread.unread_mentions_count, 0),
    [threads]
  );

  function selectPhotos(files: FileList | null) {
    const next = Array.from(files ?? []);
    if (next.length > 3) {
      toast("Envie no máximo 3 fotos por pedido.", "error");
      return;
    }
    const invalid = next.find(
      (file) =>
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 6 * 1024 * 1024
    );
    if (invalid) {
      toast("Use JPG, PNG ou WebP com até 6MB por foto.", "error");
      return;
    }
    setPhotos(next);
  }

  async function submitRequest(event: React.FormEvent) {
    event.preventDefault();
    if (!form.maquina_id || !form.equipe_id || !form.projeto_id || !form.talhao.trim() || !form.descricao.trim()) {
      toast("Selecione máquina, frente, projeto, talhão e descreva o problema.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const data = new FormData();
      data.set("maquina_id", form.maquina_id);
      data.set("equipe_id", form.equipe_id);
      data.set("projeto_id", form.projeto_id);
      data.set("talhao", form.talhao.trim());
      data.set("descricao", form.descricao.trim());
      data.set("status_maquina", form.status_maquina);
      data.set("mention_ids", JSON.stringify(mentionIds));
      photos.forEach((photo) => data.append("photos", photo));

      const response = await fetch("/api/manutencoes", { method: "POST", body: data });
      const json = (await response.json().catch(() => ({}))) as {
        error?: string;
        photo_errors?: string[];
      };
      if (!response.ok || json.error) throw new Error(json.error ?? response.statusText);

      if (json.photo_errors?.length) {
        toast(`Pedido criado, mas algumas fotos falharam: ${json.photo_errors.join("; ")}`, "error");
      } else {
        toast("Pedido de manutenção publicado.", "success");
      }

      setForm((current) => ({ ...current, talhao: "", descricao: "" }));
      setMentionIds([]);
      setPhotos([]);
      await loadThreads();
      onChanged?.();
    } catch (err) {
      toast(`Erro: ${(err as Error).message}`, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitComment(threadId: string) {
    const texto = (commentDrafts[threadId] ?? "").trim();
    if (!texto) {
      toast("Escreva um comentário.", "error");
      return;
    }

    setCommentingId(threadId);
    try {
      const response = await fetch(`/api/manutencoes/${threadId}/comentarios`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          texto,
          mention_ids: commentMentions[threadId] ?? [],
        }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok || json.error) throw new Error(json.error ?? response.statusText);
      setCommentDrafts((current) => ({ ...current, [threadId]: "" }));
      setCommentMentions((current) => ({ ...current, [threadId]: [] }));
      toast("Comentário publicado.", "success");
      await loadThreads();
      onChanged?.();
    } catch (err) {
      toast(`Erro: ${(err as Error).message}`, "error");
    } finally {
      setCommentingId(null);
    }
  }

  async function patchThreadStatus(thread: ManutencaoThread, status: MaintenanceStatus) {
    setManagingId(thread.id);
    try {
      const response = await fetch(`/api/manutencoes/${thread.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status,
          status_maquina: status === "resolvido" ? "operando" : undefined,
          resolvido_em: status === "resolvido" ? undefined : null,
        }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok || json.error) throw new Error(json.error ?? response.statusText);
      toast(status === "resolvido" ? "Manutenção concluída." : "Status atualizado.", "success");
      await loadThreads();
      onChanged?.();
    } catch (err) {
      toast(`Erro: ${(err as Error).message}`, "error");
    } finally {
      setManagingId(null);
    }
  }

  async function markRead(threadId: string) {
    try {
      const response = await fetch("/api/manutencoes/mencoes/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ manutencao_id: threadId }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok || json.error) throw new Error(json.error ?? response.statusText);
      await loadThreads();
    } catch (err) {
      toast(`Erro ao marcar menções: ${(err as Error).message}`, "error");
    }
  }

  const title =
    mode === "admin"
      ? "Feed de manutenção"
      : mode === "gestor"
        ? "Manutenção em campo"
        : "Pedidos de manutenção";

  return (
    <section className={`space-y-4 ${compact ? "pb-16" : ""}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-black" style={{ color: "var(--text-primary)" }}>
            {title}
          </h2>
          <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
            {threads.filter((thread) => thread.status !== "resolvido").length} pendente(s)
            {unreadMentions > 0 ? ` · ${unreadMentions} menção(ões) nova(s)` : ""}
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => void loadThreads()} loading={loading}>
          Atualizar
        </Button>
      </div>

      {showComposer && (
        <form
          onSubmit={submitRequest}
          className="space-y-4 rounded-2xl border p-3 sm:p-4"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
        >
          <div>
            <h3 className="text-base font-black" style={{ color: "var(--text-primary)" }}>
              Novo pedido
            </h3>
            <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              Publique o problema com contexto, fotos e pessoas que precisam acompanhar.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Select
              label="Máquina"
              value={form.maquina_id}
              onChange={(event) => setForm({ ...form, maquina_id: event.target.value })}
              options={maquinas.map((maquina) => ({
                value: maquina.id,
                label: `${maquina.nome}${maquina.identificador ? ` · ${maquina.identificador}` : ""}`,
              }))}
              placeholder="Selecione"
            />
            <Select
              label="Status da máquina"
              value={form.status_maquina}
              onChange={(event) =>
                setForm({ ...form, status_maquina: event.target.value as MachineStatus })
              }
              options={MACHINE_STATUS_OPTIONS}
            />
            <Select
              label="Frente / equipe"
              value={form.equipe_id}
              onChange={(event) => setForm({ ...form, equipe_id: event.target.value })}
              options={equipes.map((equipe) => ({ value: equipe.id, label: equipe.nome }))}
              placeholder="Selecione"
            />
            <Select
              label="Projeto"
              value={form.projeto_id}
              onChange={(event) => setForm({ ...form, projeto_id: event.target.value })}
              options={projetos.map((projeto) => ({ value: projeto.id, label: projeto.nome }))}
              placeholder="Selecione"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,0.45fr)_minmax(0,1fr)]">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                Talhão
              </span>
              <input
                value={form.talhao}
                onChange={(event) => setForm({ ...form, talhao: event.target.value })}
                className="h-12 rounded-xl border-2 px-3 text-base font-bold outline-none"
                style={{
                  background: "var(--bg-input, var(--bg-card))",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
                placeholder="Ex.: 012-01"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                Descrição
              </span>
              <textarea
                value={form.descricao}
                onChange={(event) => setForm({ ...form, descricao: event.target.value })}
                className="min-h-28 rounded-xl border-2 px-3 py-2 text-base font-semibold outline-none"
                style={{
                  background: "var(--bg-input, var(--bg-card))",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
                placeholder="Descreva o defeito, sintoma e urgência."
              />
            </label>
          </div>

          <MentionPicker
            people={mentionables}
            selectedIds={mentionIds}
            currentUserId={currentUserId}
            onChange={setMentionIds}
            label="Marcar pessoas"
          />

          <div className="space-y-2">
            <label className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>
              Fotos do problema
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) => selectPhotos(event.target.files)}
              className="block w-full rounded-xl border p-3 text-sm font-semibold"
              style={{
                background: "var(--bg-card-alt)",
                borderColor: "var(--border)",
                color: "var(--text-secondary)",
              }}
            />
            {photoPreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photoPreviews.map((url) => (
                  <img
                    key={url}
                    src={url}
                    alt="Preview da foto"
                    className="h-28 w-full rounded-xl object-cover"
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            {(photos.length > 0 || mentionIds.length > 0 || form.descricao || form.talhao) && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setPhotos([]);
                  setMentionIds([]);
                  setForm((current) => ({ ...current, talhao: "", descricao: "" }));
                }}
              >
                Limpar
              </Button>
            )}
            <Button type="submit" loading={submitting}>
              Publicar pedido
            </Button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { key: "todos", label: "Todos", count: threads.length },
          {
            key: "meus",
            label: "Meus pedidos",
            count: threads.filter((thread) => thread.reportado_por === currentUserId).length,
          },
          {
            key: "mencionados",
            label: "Mencionaram você",
            count: threads.filter((thread) =>
              currentUserId ? thread.mentioned_profile_ids.includes(currentUserId) : false
            ).length,
          },
          {
            key: "pendentes",
            label: "Pendentes",
            count: threads.filter((thread) => thread.status !== "resolvido").length,
          },
        ].map((item) => {
          const active = filter === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key as FeedFilter)}
              className="min-h-12 rounded-xl border px-3 text-xs font-black"
              style={{
                background: active ? "var(--accent)" : "var(--bg-card)",
                borderColor: active ? "var(--accent)" : "var(--border)",
                color: active ? "#fff" : "var(--text-secondary)",
              }}
            >
              {item.label} ({item.count})
            </button>
          );
        })}
      </div>

      {loading && threads.length === 0 ? (
        <div className="rounded-2xl border p-6 text-center text-sm font-semibold" style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text-muted)" }}>
          Carregando pedidos...
        </div>
      ) : filteredThreads.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm font-semibold" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          Nenhum pedido neste filtro.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredThreads.map((thread) => {
            const meta = STATUS_META[thread.status];
            const draft = commentDrafts[thread.id] ?? "";
            const selectedCommentMentions = commentMentions[thread.id] ?? [];

            return (
              <article
                key={thread.id}
                className="rounded-2xl border p-3 sm:p-4"
                style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="rounded-full px-2.5 py-1 text-[11px] font-black"
                        style={{ background: meta.bg, color: meta.color }}
                      >
                        {meta.label}
                      </span>
                      {thread.unread_mentions_count > 0 && (
                        <button
                          type="button"
                          onClick={() => void markRead(thread.id)}
                          className="rounded-full px-2.5 py-1 text-[11px] font-black"
                          style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
                        >
                          {thread.unread_mentions_count} menção nova
                        </button>
                      )}
                    </div>
                    <h3 className="mt-2 text-base font-black" style={{ color: "var(--text-primary)" }}>
                      {thread.maquinas?.nome ?? "Máquina removida"}
                    </h3>
                    <ThreadContext thread={thread} />
                    <p className="mt-2 text-sm font-semibold leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {thread.descricao}
                    </p>
                    <p className="mt-2 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                      Aberto por {thread.autor?.nome ?? "Usuário"} em {ddmmyyyy(thread.created_at)}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2 sm:w-44">
                    {thread.can_manage_status && (
                      <select
                        value={thread.status}
                        disabled={managingId === thread.id}
                        onChange={(event) =>
                          void patchThreadStatus(thread, event.target.value as MaintenanceStatus)
                        }
                        className="h-10 rounded-xl border px-2 text-xs font-black"
                        style={{
                          background: "var(--bg-card-alt)",
                          borderColor: "var(--border)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {Object.entries(STATUS_META).map(([value, statusMeta]) => (
                          <option key={value} value={value}>
                            {statusMeta.label}
                          </option>
                        ))}
                      </select>
                    )}
                    {thread.can_resolve && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        loading={managingId === thread.id}
                        onClick={() => void patchThreadStatus(thread, "resolvido")}
                      >
                        Concluir
                      </Button>
                    )}
                  </div>
                </div>

                {thread.anexos.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {thread.anexos.map((anexo) => (
                      <a
                        key={anexo.id}
                        href={anexo.url ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-xl border"
                        style={{ borderColor: "var(--border)" }}
                      >
                        {anexo.url ? (
                          <img
                            src={anexo.url}
                            alt={anexo.file_name}
                            className="h-40 w-full object-cover"
                          />
                        ) : (
                          <span className="grid h-40 place-items-center text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                            Foto indisponível
                          </span>
                        )}
                      </a>
                    ))}
                  </div>
                )}

                {thread.mentioned_profile_ids.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {mentionables
                      .filter((person) => thread.mentioned_profile_ids.includes(person.id))
                      .map((person) => (
                        <span
                          key={person.id}
                          className="rounded-full px-2 py-0.5 text-[11px] font-black"
                          style={{ background: "var(--bg-page)", color: "var(--text-secondary)" }}
                        >
                          @{compactName(person.nome)}
                        </span>
                      ))}
                  </div>
                )}

                <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
                      Comentários ({thread.comentarios_count})
                    </h4>
                  </div>

                  {thread.comentarios.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {thread.comentarios.map((comment) => (
                        <div
                          key={comment.id}
                          className="rounded-xl p-3"
                          style={{ background: "var(--bg-card-alt)" }}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
                              {comment.autor?.nome ?? "Usuário"}
                            </p>
                            <span className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
                              {ddmmyyyy(comment.created_at)}
                            </span>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                            {comment.texto}
                          </p>
                          {comment.mencoes && comment.mencoes.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {comment.mencoes.map((mention) => (
                                <span
                                  key={mention.id}
                                  className="rounded-full px-2 py-0.5 text-[11px] font-black"
                                  style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
                                >
                                  @{compactName(mention.mentioned?.nome ?? "Usuário")}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {thread.can_comment ? (
                    <div className="mt-3 space-y-3">
                      <textarea
                        value={draft}
                        onChange={(event) =>
                          setCommentDrafts((current) => ({
                            ...current,
                            [thread.id]: event.target.value,
                          }))
                        }
                        className="min-h-24 w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none"
                        style={{
                          background: "var(--bg-input, var(--bg-card))",
                          borderColor: "var(--border)",
                          color: "var(--text-primary)",
                        }}
                        placeholder="Comente ou direcione a manutenção..."
                      />
                      <MentionPicker
                        people={mentionables}
                        selectedIds={selectedCommentMentions}
                        currentUserId={currentUserId}
                        onChange={(ids) =>
                          setCommentMentions((current) => ({ ...current, [thread.id]: ids }))
                        }
                        label="Marcar no comentário"
                      />
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          loading={commentingId === thread.id}
                          onClick={() => void submitComment(thread.id)}
                        >
                          Comentar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 rounded-xl border border-dashed p-3 text-xs font-semibold" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                      Você pode acompanhar este pedido. Para comentar, precisa ser autor, estar marcado, já ter comentado, ou ser gestor/admin.
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
