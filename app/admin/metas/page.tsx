"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import ListControls, { searchItems, visibleItems } from "@/components/ui/ListControls";
import { useToast } from "@/components/ui/Toast";
import { brl, num } from "@/lib/format";
import type { Atividade, Equipe, Meta, MetaAtividade, Profile, UserRole } from "@/lib/types";

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

type ProfileWithEquipe = Profile & { equipes: { nome: string } | null };

type MetaAtividadeComRelacoes = MetaAtividade & {
  atividades: { nome: string; unidade: string; valor_unitario: number | string } | null;
  equipes: { nome: string } | null;
  profiles: { nome: string; email: string; role: UserRole } | null;
};

type MetaAtividadeForm = {
  ano: string;
  mes: string;
  atividade_id: string;
  equipe_id: string;
  profile_id: string;
  quantidade_meta: string;
  observacoes: string;
};

function roleLabel(role: UserRole) {
  if (role === "admin") return "Admin";
  if (role === "gestor") return "Gestor";
  return "Encarregado";
}

function roleTone(role: UserRole) {
  if (role === "admin") return "danger" as const;
  if (role === "gestor") return "info" as const;
  return "success" as const;
}

function escopoMeta(meta: MetaAtividadeComRelacoes) {
  if (meta.profiles) return `Acesso: ${meta.profiles.nome}`;
  if (meta.equipes) return `Frente: ${meta.equipes.nome}`;
  return "Geral";
}

export default function MetasPage() {
  const { toast } = useToast();
  const today = new Date();
  const [items, setItems] = useState<Meta[]>([]);
  const [metasAtividades, setMetasAtividades] = useState<MetaAtividadeComRelacoes[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [usuarios, setUsuarios] = useState<ProfileWithEquipe[]>([]);
  const [ano, setAno] = useState(String(today.getFullYear()));
  const [mes, setMes] = useState(String(today.getMonth() + 1));
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");
  const [busca, setBusca] = useState("");
  const [expandida, setExpandida] = useState(false);
  const [metaAtividade, setMetaAtividade] = useState<MetaAtividadeForm>({
    ano: String(today.getFullYear()),
    mes: String(today.getMonth() + 1),
    atividade_id: "",
    equipe_id: "",
    profile_id: "",
    quantidade_meta: "",
    observacoes: "",
  });

  async function carregar() {
    try {
      const [metasResp, atividadesResp, equipesResp, usuariosResp, metasAtividadesResp] =
        await Promise.all([
          fetch("/api/metas").then((r) => r.json()),
          fetch("/api/atividades").then((r) => r.json()),
          fetch("/api/equipes").then((r) => r.json()),
          fetch("/api/usuarios").then((r) => r.json()),
          fetch("/api/metas/atividades").then(async (r) => ({
            ok: r.ok,
            body: await r.json().catch(() => ({})),
          })),
        ]);

      setItems(Array.isArray(metasResp.items) ? (metasResp.items as Meta[]) : []);
      setAtividades(
        Array.isArray(atividadesResp.items)
          ? (atividadesResp.items as Atividade[]).filter((a) => a.ativo)
          : []
      );
      setEquipes(
        Array.isArray(equipesResp.items)
          ? (equipesResp.items as Equipe[]).filter((e) => e.ativo)
          : []
      );
      setUsuarios(
        Array.isArray(usuariosResp.items)
          ? (usuariosResp.items as ProfileWithEquipe[]).filter((u) => u.ativo)
          : []
      );
      if (metasAtividadesResp.ok) {
        setMetasAtividades(
          Array.isArray(metasAtividadesResp.body.items)
            ? (metasAtividadesResp.body.items as MetaAtividadeComRelacoes[])
            : []
        );
      } else {
        setMetasAtividades([]);
        toast(
          `Metas por atividade ainda não carregaram: ${
            metasAtividadesResp.body.error ?? "rode o SQL de metas por atividade"
          }`,
          "error"
        );
      }
    } catch (err) {
      setItems([]);
      setMetasAtividades([]);
      toast(`Erro ao carregar metas: ${(err as Error).message}`, "error");
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const metasFiltradas = useMemo(
    () =>
      searchItems(metasAtividades, busca, [
        (m) => m.atividades?.nome,
        (m) => m.atividades?.unidade,
        (m) => m.equipes?.nome,
        (m) => m.profiles?.nome,
        (m) => m.profiles?.email,
        (m) => m.observacoes,
        (m) => `${MESES[m.mes - 1]}/${m.ano}`,
      ]),
    [busca, metasAtividades]
  );
  const metasVisiveis = useMemo(
    () => visibleItems(metasFiltradas, expandida, 20),
    [expandida, metasFiltradas]
  );

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!valor || Number(valor) < 0) {
      toast("Informe a meta.", "error");
      return;
    }
    const r = await fetch("/api/metas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ano: Number(ano),
        mes: Number(mes),
        valor_meta: Number(valor),
        observacoes: obs || null,
      }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast(`Erro: ${j.error ?? r.statusText}`, "error");
      return;
    }
    toast("Meta mensal salva.", "success");
    setValor("");
    setObs("");
    carregar();
  }

  async function salvarMetaAtividade(e: React.FormEvent) {
    e.preventDefault();
    if (!metaAtividade.atividade_id || !metaAtividade.quantidade_meta) {
      toast("Informe atividade e meta.", "error");
      return;
    }

    const r = await fetch("/api/metas/atividades", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ano: Number(metaAtividade.ano),
        mes: Number(metaAtividade.mes),
        atividade_id: metaAtividade.atividade_id,
        equipe_id: metaAtividade.equipe_id || null,
        profile_id: metaAtividade.profile_id || null,
        quantidade_meta: Number(metaAtividade.quantidade_meta),
        observacoes: metaAtividade.observacoes || null,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) {
      toast(`Erro: ${j.error ?? r.statusText}`, "error");
      return;
    }

    toast("Meta por atividade salva.", "success");
    setMetaAtividade((prev) => ({
      ...prev,
      atividade_id: "",
      equipe_id: "",
      profile_id: "",
      quantidade_meta: "",
      observacoes: "",
    }));
    carregar();
  }

  async function excluirMetaAtividade(id: string) {
    if (!confirm("Excluir esta meta por atividade?")) return;
    const r = await fetch(`/api/metas/atividades?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) {
      toast(`Erro: ${j.error ?? r.statusText}`, "error");
      return;
    }
    toast("Meta por atividade excluída.", "success");
    carregar();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Metas</h1>
        <p className="text-sm font-bold text-[var(--color-ink-600)]">
          Defina a meta mensal geral e as metas por atividade. O resumo do
          encarregado usa as metas por acesso, frente ou atividade geral.
        </p>
      </div>

      <Card className="p-5">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-[var(--color-ink-900)]">
            Meta mensal de faturamento
          </h2>
          <p className="text-sm font-semibold text-[var(--color-ink-600)]">
            Usada no dashboard geral para calcular % atingido e meta do próximo dia.
          </p>
        </div>
        <form onSubmit={salvar} className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          <Input label="Ano" type="number" value={ano} onChange={(e) => setAno(e.target.value)} />
          <Select
            label="Mês"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            options={MESES.map((m, i) => ({ value: String(i + 1), label: m }))}
          />
          <Input
            label="Valor meta (R$)"
            type="number"
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="ex.: 120000"
          />
          <Input
            label="Observações"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="opcional"
          />
          <div className="flex items-end">
            <Button type="submit" className="w-full">
              Salvar
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="border-b border-[var(--color-ink-100)] p-4">
          <h2 className="text-lg font-bold text-[var(--color-ink-900)]">
            Histórico de metas mensais
          </h2>
        </div>
        <div className="divide-y divide-[var(--color-ink-100)] lg:hidden">
          {items.map((m) => (
            <div key={m.id} className="p-4">
              <p className="text-base font-bold capitalize text-[var(--color-ink-900)]">
                {MESES[m.mes - 1]}/{m.ano}
              </p>
              <p className="mt-1 text-xl font-bold text-[var(--color-gn-700)] tabular">
                {brl(m.valor_meta)}
              </p>
              {m.observacoes && (
                <p className="mt-2 text-sm font-semibold text-[var(--color-ink-700)]">
                  {m.observacoes}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-ink-50)] text-left text-[var(--color-ink-500)]">
              <tr>
                <th className="px-4 py-2 font-bold">Período</th>
                <th className="px-4 py-2 text-right font-bold">Meta</th>
                <th className="px-4 py-2 font-bold">Observações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} className="border-t border-[var(--color-ink-100)]">
                  <td className="px-4 py-2 font-semibold capitalize">
                    {MESES[m.mes - 1]}/{m.ano}
                  </td>
                  <td className="px-4 py-2 text-right font-bold tabular">
                    {brl(m.valor_meta)}
                  </td>
                  <td className="px-4 py-2 font-semibold text-[var(--color-ink-700)]">
                    {m.observacoes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-[var(--color-ink-900)]">
            Metas por atividade
          </h2>
          <p className="text-sm font-semibold text-[var(--color-ink-600)]">
            Defina metas por acesso específico, por frente ou gerais. O acesso
            específico tem prioridade sobre frente, e frente tem prioridade sobre geral.
          </p>
        </div>
        <form onSubmit={salvarMetaAtividade} className="grid grid-cols-1 gap-3 lg:grid-cols-6">
          <Input
            label="Ano"
            type="number"
            value={metaAtividade.ano}
            onChange={(e) => setMetaAtividade({ ...metaAtividade, ano: e.target.value })}
          />
          <Select
            label="Mês"
            value={metaAtividade.mes}
            onChange={(e) => setMetaAtividade({ ...metaAtividade, mes: e.target.value })}
            options={MESES.map((m, i) => ({ value: String(i + 1), label: m }))}
          />
          <Select
            label="Atividade"
            value={metaAtividade.atividade_id}
            onChange={(e) =>
              setMetaAtividade({ ...metaAtividade, atividade_id: e.target.value })
            }
            options={atividades.map((a) => ({ value: a.id, label: a.nome }))}
            placeholder="Selecione"
            className="lg:min-w-56"
          />
          <Select
            label="Acesso"
            value={metaAtividade.profile_id}
            onChange={(e) =>
              setMetaAtividade({
                ...metaAtividade,
                profile_id: e.target.value,
                equipe_id: e.target.value ? "" : metaAtividade.equipe_id,
              })
            }
            options={usuarios.map((u) => ({ value: u.id, label: `${u.nome} · ${roleLabel(u.role)}` }))}
            placeholder="Geral ou por frente"
          />
          <Select
            label="Frente"
            value={metaAtividade.equipe_id}
            onChange={(e) =>
              setMetaAtividade({ ...metaAtividade, equipe_id: e.target.value })
            }
            disabled={Boolean(metaAtividade.profile_id)}
            options={equipes.map((e) => ({ value: e.id, label: e.nome }))}
            placeholder={metaAtividade.profile_id ? "Acesso selecionado" : "Geral"}
          />
          <Input
            label="Meta"
            type="number"
            step="0.01"
            value={metaAtividade.quantidade_meta}
            onChange={(e) =>
              setMetaAtividade({ ...metaAtividade, quantidade_meta: e.target.value })
            }
            placeholder="ha"
          />
          <div className="lg:col-span-5">
            <Input
              label="Observações"
              value={metaAtividade.observacoes}
              onChange={(e) =>
                setMetaAtividade({ ...metaAtividade, observacoes: e.target.value })
              }
              placeholder="opcional"
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full">
              Salvar meta
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="border-b border-[var(--color-ink-100)] p-4">
          <ListControls
            search={busca}
            onSearchChange={setBusca}
            expanded={expandida}
            onExpandedChange={setExpandida}
            total={metasFiltradas.length}
            visible={metasVisiveis.length}
            label="Pesquisar metas por atividade"
            placeholder="Atividade, acesso, frente ou período"
          />
        </div>

        <div className="divide-y divide-[var(--color-ink-100)] lg:hidden">
          {metasVisiveis.map((m) => (
            <div key={m.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-base font-bold text-[var(--color-ink-900)]">
                    {m.atividades?.nome ?? "Atividade sem nome"}
                  </p>
                  <p className="mt-1 text-sm font-bold capitalize text-[var(--color-ink-600)]">
                    {MESES[m.mes - 1]}/{m.ano}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--color-ink-700)]">
                    {escopoMeta(m)}
                  </p>
                </div>
                {m.profiles ? (
                  <Badge tone={roleTone(m.profiles.role)}>{roleLabel(m.profiles.role)}</Badge>
                ) : (
                  <Badge tone={m.equipes ? "info" : "neutral"}>
                    {m.equipes ? "frente" : "geral"}
                  </Badge>
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-[var(--color-ink-50)] p-3">
                  <p className="text-xs font-bold uppercase text-[var(--color-ink-600)]">
                    Meta
                  </p>
                  <p className="mt-1 font-bold tabular">
                    {num(m.quantidade_meta)} {m.atividades?.unidade ?? "ha"}
                  </p>
                </div>
                <div className="rounded-xl bg-[var(--color-ink-50)] p-3">
                  <p className="text-xs font-bold uppercase text-[var(--color-ink-600)]">
                    Planejado
                  </p>
                  <p className="mt-1 font-bold tabular">
                    {brl(Number(m.quantidade_meta) * Number(m.atividades?.valor_unitario ?? 0))}
                  </p>
                </div>
              </div>
              {m.observacoes && (
                <p className="mt-3 text-sm font-semibold text-[var(--color-ink-700)]">
                  {m.observacoes}
                </p>
              )}
              <div className="mt-4">
                <Button
                  type="button"
                  variant="danger"
                  className="w-full"
                  onClick={() => excluirMetaAtividade(m.id)}
                >
                  Excluir meta
                </Button>
              </div>
            </div>
          ))}
          {metasFiltradas.length === 0 && (
            <div className="p-6 text-center text-sm font-semibold text-[var(--color-ink-600)]">
              Nenhuma meta por atividade encontrada.
            </div>
          )}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--color-ink-50)] text-[var(--color-ink-500)]">
              <tr>
                <th className="px-4 py-2 font-bold">Período</th>
                <th className="px-4 py-2 font-bold">Atividade</th>
                <th className="px-4 py-2 font-bold">Escopo</th>
                <th className="px-4 py-2 text-right font-bold">Meta</th>
                <th className="px-4 py-2 text-right font-bold">Faturamento meta</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {metasVisiveis.map((m) => (
                <tr key={m.id} className="border-t border-[var(--color-ink-100)] align-top">
                  <td className="px-4 py-2 font-semibold capitalize">
                    {MESES[m.mes - 1]}/{m.ano}
                  </td>
                  <td className="px-4 py-2 font-semibold">
                    {m.atividades?.nome ?? "Atividade sem nome"}
                    {m.observacoes && (
                      <p className="mt-1 text-xs font-semibold text-[var(--color-ink-500)]">
                        {m.observacoes}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-2 font-semibold">{escopoMeta(m)}</td>
                  <td className="px-4 py-2 text-right font-bold tabular">
                    {num(m.quantidade_meta)} {m.atividades?.unidade ?? "ha"}
                  </td>
                  <td className="px-4 py-2 text-right font-bold tabular">
                    {brl(Number(m.quantidade_meta) * Number(m.atividades?.valor_unitario ?? 0))}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => excluirMetaAtividade(m.id)}
                      className="text-xs font-bold text-[var(--color-danger-500)] hover:underline"
                    >
                      excluir
                    </button>
                  </td>
                </tr>
              ))}
              {metasFiltradas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-[var(--color-ink-500)]">
                    Nenhuma meta por atividade encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
