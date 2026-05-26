"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { num } from "@/lib/format";
import type { ProjetoComTalhoes, Talhao } from "@/lib/types";

type ProjetoForm = { nome: string };
type TalhaoForm = { codigo: string; area_ha: string; observacoes: string };

const EMPTY_TALHAO: TalhaoForm = { codigo: "", area_ha: "", observacoes: "" };

function sortTalhoes(talhoes: Talhao[]) {
  return [...talhoes].sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }));
}

export default function ProjetosAdminPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<ProjetoComTalhoes[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [projetoForm, setProjetoForm] = useState<ProjetoForm>({ nome: "" });
  const [talhaoForms, setTalhaoForms] = useState<Record<string, TalhaoForm>>({});
  const [editingProjeto, setEditingProjeto] = useState<Record<string, string>>({});
  const [editingTalhao, setEditingTalhao] = useState<Record<string, TalhaoForm>>({});

  async function carregar() {
    setLoading(true);
    try {
      const res = await fetch("/api/projetos?include_talhoes=1", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao carregar projetos");
      setItems(Array.isArray(json.items) ? json.items : []);
      if (json.talhoes_error) {
        toast("Execute o SQL de talhões no Supabase para liberar o cadastro completo.", "error");
      }
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return items;
    return items.filter((projeto) => {
      const projetoMatch = projeto.nome.toLowerCase().includes(termo);
      const talhaoMatch = (projeto.talhoes ?? []).some((talhao) =>
        `${talhao.codigo} ${talhao.observacoes ?? ""}`.toLowerCase().includes(termo)
      );
      return projetoMatch || talhaoMatch;
    });
  }, [busca, items]);

  const totalTalhoes = items.reduce((sum, projeto) => sum + (projeto.talhoes?.filter((t) => t.ativo).length ?? 0), 0);

  async function criarProjeto() {
    const nome = projetoForm.nome.trim();
    if (!nome) {
      toast("Informe o nome do projeto.", "error");
      return;
    }
    const res = await fetch("/api/projetos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nome, ativo: true }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast(`Erro: ${json.error ?? res.statusText}`, "error");
      return;
    }
    setProjetoForm({ nome: "" });
    toast("Projeto salvo.", "success");
    carregar();
  }

  async function salvarProjeto(id: string) {
    const nome = editingProjeto[id]?.trim();
    if (!nome) {
      toast("Informe o nome do projeto.", "error");
      return;
    }
    const res = await fetch(`/api/projetos/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nome }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast(`Erro: ${json.error ?? res.statusText}`, "error");
      return;
    }
    setEditingProjeto((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    toast("Projeto atualizado.", "success");
    carregar();
  }

  async function desativarProjeto(id: string) {
    if (!confirm("Desativar este projeto? Ele não aparecerá nos novos lançamentos.")) return;
    const res = await fetch(`/api/projetos/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast(`Erro: ${json.error ?? res.statusText}`, "error");
      return;
    }
    toast("Projeto desativado.", "success");
    carregar();
  }

  async function criarTalhao(projetoId: string) {
    const form = talhaoForms[projetoId] ?? EMPTY_TALHAO;
    const codigo = form.codigo.trim();
    if (!codigo) {
      toast("Informe o código do talhão.", "error");
      return;
    }
    const res = await fetch(`/api/projetos/${projetoId}/talhoes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        codigo,
        area_ha: form.area_ha,
        observacoes: form.observacoes,
        ativo: true,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast(`Erro: ${json.error ?? res.statusText}`, "error");
      return;
    }
    setTalhaoForms((current) => ({ ...current, [projetoId]: EMPTY_TALHAO }));
    toast("Talhão salvo.", "success");
    carregar();
  }

  async function salvarTalhao(id: string) {
    const form = editingTalhao[id];
    if (!form?.codigo.trim()) {
      toast("Informe o código do talhão.", "error");
      return;
    }
    const res = await fetch(`/api/talhoes/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast(`Erro: ${json.error ?? res.statusText}`, "error");
      return;
    }
    setEditingTalhao((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    toast("Talhão atualizado.", "success");
    carregar();
  }

  async function desativarTalhao(id: string) {
    if (!confirm("Desativar este talhão?")) return;
    const res = await fetch(`/api/talhoes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast(`Erro: ${json.error ?? res.statusText}`, "error");
      return;
    }
    toast("Talhão desativado.", "success");
    carregar();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>
            Projetos e talhões
          </h1>
          <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
            Cadastre as fazendas como projetos e organize os talhões usados em planejamento e apontamentos.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 md:min-w-72">
          <Metric label="Projetos ativos" value={items.filter((p) => p.ativo).length} />
          <Metric label="Talhões ativos" value={totalTalhoes} />
        </div>
      </div>

      <section className="rounded-2xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <Input
            label="Novo projeto"
            placeholder="Ex.: Mãe Santa"
            value={projetoForm.nome}
            onChange={(e) => setProjetoForm({ nome: e.target.value })}
          />
          <Button onClick={criarProjeto}>+ Adicionar projeto</Button>
        </div>
      </section>

      <section className="rounded-2xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <Input
          label="Pesquisar"
          placeholder="Projeto, talhão ou observação"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </section>

      {loading ? (
        <p className="py-12 text-center text-sm font-bold" style={{ color: "var(--text-muted)" }}>
          Carregando projetos...
        </p>
      ) : filtrados.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-lg font-black" style={{ color: "var(--text-primary)" }}>
            Nenhum projeto encontrado
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Ajuste a busca ou cadastre um novo projeto.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map((projeto) => {
            const isOpen = expanded === projeto.id;
            const talhoes = sortTalhoes(projeto.talhoes ?? []);
            const form = talhaoForms[projeto.id] ?? EMPTY_TALHAO;
            const projetoNomeEditavel = editingProjeto[projeto.id] !== undefined;
            return (
              <article
                key={projeto.id}
                className="rounded-2xl"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : projeto.id)}
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg font-black"
                      style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
                    >
                      {isOpen ? "−" : "+"}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-lg font-black" style={{ color: "var(--text-primary)" }}>
                        {projeto.nome}
                      </span>
                      <span className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
                        {talhoes.filter((t) => t.ativo).length} talhão{talhoes.filter((t) => t.ativo).length === 1 ? "" : "es"} ativo{talhoes.filter((t) => t.ativo).length === 1 ? "" : "s"}
                      </span>
                    </span>
                  </button>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditingProjeto((current) => ({ ...current, [projeto.id]: projeto.nome }))}
                    >
                      Editar
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => desativarProjeto(projeto.id)}>
                      Desativar
                    </Button>
                  </div>
                </div>

                {isOpen && (
                  <div className="space-y-4 border-t p-4" style={{ borderColor: "var(--border)" }}>
                    {projetoNomeEditavel && (
                      <div className="grid gap-2 md:grid-cols-[1fr_auto_auto] md:items-end">
                        <Input
                          label="Nome do projeto"
                          value={editingProjeto[projeto.id] ?? ""}
                          onChange={(e) => setEditingProjeto((current) => ({ ...current, [projeto.id]: e.target.value }))}
                        />
                        <Button onClick={() => salvarProjeto(projeto.id)}>Salvar</Button>
                        <Button
                          variant="ghost"
                          onClick={() => setEditingProjeto((current) => {
                            const next = { ...current };
                            delete next[projeto.id];
                            return next;
                          })}
                        >
                          Cancelar
                        </Button>
                      </div>
                    )}

                    <div className="rounded-2xl p-3" style={{ background: "var(--bg-card-alt)", border: "1px solid var(--border)" }}>
                      <p className="mb-3 text-sm font-black" style={{ color: "var(--text-primary)" }}>
                        Adicionar talhão
                      </p>
                      <div className="grid gap-3 md:grid-cols-[1fr_160px_1fr_auto] md:items-end">
                        <Input
                          label="Código"
                          placeholder="Ex.: 017-01"
                          value={form.codigo}
                          onChange={(e) => setTalhaoForms((current) => ({
                            ...current,
                            [projeto.id]: { ...form, codigo: e.target.value },
                          }))}
                        />
                        <Input
                          label="Área (ha)"
                          type="number"
                          step="0.001"
                          placeholder="Opcional"
                          value={form.area_ha}
                          onChange={(e) => setTalhaoForms((current) => ({
                            ...current,
                            [projeto.id]: { ...form, area_ha: e.target.value },
                          }))}
                        />
                        <Input
                          label="Observações"
                          placeholder="Opcional"
                          value={form.observacoes}
                          onChange={(e) => setTalhaoForms((current) => ({
                            ...current,
                            [projeto.id]: { ...form, observacoes: e.target.value },
                          }))}
                        />
                        <Button onClick={() => criarTalhao(projeto.id)}>Adicionar</Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {talhoes.length === 0 ? (
                        <p className="rounded-xl p-4 text-sm font-bold" style={{ color: "var(--text-muted)", background: "var(--bg-card-alt)" }}>
                          Nenhum talhão cadastrado neste projeto.
                        </p>
                      ) : (
                        talhoes.map((talhao) => {
                          const editing = editingTalhao[talhao.id];
                          return (
                            <div
                              key={talhao.id}
                              className="rounded-xl p-3"
                              style={{ background: "var(--bg-card-alt)", border: "1px solid var(--border)" }}
                            >
                              {editing ? (
                                <div className="grid gap-2 md:grid-cols-[1fr_150px_1fr_auto_auto] md:items-end">
                                  <Input
                                    label="Código"
                                    value={editing.codigo}
                                    onChange={(e) => setEditingTalhao((current) => ({
                                      ...current,
                                      [talhao.id]: { ...editing, codigo: e.target.value },
                                    }))}
                                  />
                                  <Input
                                    label="Área (ha)"
                                    type="number"
                                    step="0.001"
                                    value={editing.area_ha}
                                    onChange={(e) => setEditingTalhao((current) => ({
                                      ...current,
                                      [talhao.id]: { ...editing, area_ha: e.target.value },
                                    }))}
                                  />
                                  <Input
                                    label="Observações"
                                    value={editing.observacoes}
                                    onChange={(e) => setEditingTalhao((current) => ({
                                      ...current,
                                      [talhao.id]: { ...editing, observacoes: e.target.value },
                                    }))}
                                  />
                                  <Button onClick={() => salvarTalhao(talhao.id)}>Salvar</Button>
                                  <Button
                                    variant="ghost"
                                    onClick={() => setEditingTalhao((current) => {
                                      const next = { ...current };
                                      delete next[talhao.id];
                                      return next;
                                    })}
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                  <div>
                                    <p className="text-base font-black" style={{ color: "var(--text-primary)" }}>
                                      Talhão {talhao.codigo}
                                    </p>
                                    <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
                                      {talhao.area_ha != null ? `${num(talhao.area_ha, 3)} ha` : "Área não informada"}
                                      {talhao.observacoes ? ` · ${talhao.observacoes}` : ""}
                                      {!talhao.ativo ? " · inativo" : ""}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => setEditingTalhao((current) => ({
                                        ...current,
                                        [talhao.id]: {
                                          codigo: talhao.codigo,
                                          area_ha: talhao.area_ha == null ? "" : String(talhao.area_ha),
                                          observacoes: talhao.observacoes ?? "",
                                        },
                                      }))}
                                    >
                                      Editar
                                    </Button>
                                    {talhao.ativo && (
                                      <Button variant="danger" size="sm" onClick={() => desativarTalhao(talhao.id)}>
                                        Inativar
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <p className="text-2xl font-black" style={{ color: "var(--accent)" }}>
        {value}
      </p>
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
    </div>
  );
}
