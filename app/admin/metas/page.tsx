"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { brl } from "@/lib/format";
import type { Equipe, Meta, MetaEquipe } from "@/lib/types";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function normalizarNumeroBR(value: string): number {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d,.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "," || cleaned === ".") return 0;
  if (cleaned.includes(",")) {
    return Number(cleaned.replace(/\./g, "").replace(",", "."));
  }
  return Number(cleaned);
}

function formatarNumeroInput(value: number): string {
  if (!Number.isFinite(value)) return "";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function limparNumeroInput(value: string): string {
  return value.replace(/[^\d.,-]/g, "");
}

export default function MetasPage() {
  const { toast } = useToast();
  const today = new Date();
  const [items, setItems] = useState<Meta[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [ano, setAno] = useState(String(today.getFullYear()));
  const [mes, setMes] = useState(String(today.getMonth() + 1));
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [metasEquipe, setMetasEquipe] = useState<Record<string, string>>({});
  const [loadingMetasEquipe, setLoadingMetasEquipe] = useState(false);
  const [savingMetasEquipe, setSavingMetasEquipe] = useState(false);
  const [metaEquipeSetupError, setMetaEquipeSetupError] = useState<string | null>(null);

  async function carregar() {
    try {
      const resp = await fetch("/api/metas").then((r) => r.json());
      const metas = Array.isArray(resp.items) ? (resp.items as Meta[]) : [];
      setItems(metas);
      return metas;
    } catch (err) {
      toast(`Erro ao carregar metas: ${(err as Error).message}`, "error");
      return [];
    }
  }

  async function carregarEquipes() {
    try {
      const resp = await fetch("/api/equipes").then((r) => r.json());
      const lista = Array.isArray(resp.items) ? (resp.items as Equipe[]) : [];
      setEquipes(lista.filter((e) => e.ativo));
    } catch (err) {
      toast(`Erro ao carregar equipes: ${(err as Error).message}`, "error");
    }
  }

  async function carregarMetasEquipes(anoAtual = Number(ano), mesAtual = Number(mes)) {
    if (!Number.isInteger(anoAtual) || !Number.isInteger(mesAtual)) return;
    setLoadingMetasEquipe(true);
    setMetaEquipeSetupError(null);
    try {
      const sp = new URLSearchParams({
        ano: String(anoAtual),
        mes: String(mesAtual),
      });
      const resp = await fetch(`/api/metas/equipes?${sp.toString()}`).then((r) => r.json());
      if (resp.setupPendente) {
        setMetaEquipeSetupError(resp.setupError ?? "Tabela metas_equipes ainda não criada.");
      }
      if (Array.isArray(resp.equipes)) {
        setEquipes((resp.equipes as Equipe[]).filter((e) => e.ativo));
      }
      const valores: Record<string, string> = {};
      for (const item of (Array.isArray(resp.items) ? (resp.items as MetaEquipe[]) : [])) {
        valores[item.equipe_id] = formatarNumeroInput(Number(item.valor_meta ?? 0));
      }
      setMetasEquipe(valores);
    } catch (err) {
      setMetaEquipeSetupError((err as Error).message);
    } finally {
      setLoadingMetasEquipe(false);
    }
  }

  useEffect(() => {
    carregar();
    carregarEquipes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    carregarMetasEquipes(Number(ano), Number(mes));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, mes]);

  const anoSelecionado = Number(ano);
  const mesSelecionado = Number(mes);
  const metaMensalSelecionada = items.find(
    (item) => item.ano === anoSelecionado && item.mes === mesSelecionado
  );
  const totalMetasEquipe = equipes.reduce(
    (sum, equipe) => sum + normalizarNumeroBR(metasEquipe[equipe.id] || ""),
    0
  );
  const valorMetaMensalSelecionada = Number(metaMensalSelecionada?.valor_meta ?? 0);
  const diferencaMetasEquipe = valorMetaMensalSelecionada - totalMetasEquipe;
  const metasEquipeFechadas = Math.abs(Math.round(diferencaMetasEquipe * 100)) === 0;

  function limparFormulario() {
    setEditingId(null);
    setAno(String(today.getFullYear()));
    setMes(String(today.getMonth() + 1));
    setValor("");
    setObs("");
  }

  function editarMeta(meta: Meta) {
    setEditingId(meta.id);
    setAno(String(meta.ano));
    setMes(String(meta.mes));
    setValor(formatarNumeroInput(Number(meta.valor_meta)));
    setObs(meta.observacoes ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const valorMeta = normalizarNumeroBR(valor);
    if (!valor.trim() || !Number.isFinite(valorMeta) || valorMeta < 0) {
      toast("Informe a meta.", "error");
      return;
    }
    const anoSalvo = Number(ano);
    const mesSalvo = Number(mes);
    setSaving(true);
    try {
      const r = await fetch("/api/metas", {
        method: editingId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          ano: Number(ano),
          mes: Number(mes),
          valor_meta: valorMeta,
          observacoes: obs || null,
        }),
      });

      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast(`Erro: ${j.error ?? r.statusText}`, "error");
        return;
      }

      toast(editingId ? "Meta mensal atualizada." : "Meta mensal salva.", "success");
      setEditingId(null);
      setAno(String(anoSalvo));
      setMes(String(mesSalvo));
      setValor("");
      setObs("");
      await carregar();
      await carregarMetasEquipes(anoSalvo, mesSalvo);
    } catch (err) {
      toast(`Erro: ${(err as Error).message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  async function excluirMeta(meta: Meta) {
    const periodo = `${MESES[meta.mes - 1]}/${meta.ano}`;
    if (!confirm(`Excluir a meta de ${periodo}?`)) return;

    setDeletingId(meta.id);
    const r = await fetch(`/api/metas?id=${encodeURIComponent(meta.id)}`, {
      method: "DELETE",
    });
    setDeletingId(null);

    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast(`Erro ao excluir: ${j.error ?? r.statusText}`, "error");
      return;
    }

    if (editingId === meta.id) limparFormulario();
    toast("Meta mensal excluída.", "success");
    await carregar();
    await carregarMetasEquipes(Number(ano), Number(mes));
  }

  function atualizarMetaEquipe(equipeId: string, value: string) {
    setMetasEquipe((prev) => ({
      ...prev,
      [equipeId]: limparNumeroInput(value),
    }));
  }

  function distribuirIgual() {
    if (!metaMensalSelecionada || equipes.length === 0) return;
    const totalCents = Math.round(valorMetaMensalSelecionada * 100);
    const baseCents = Math.floor(totalCents / equipes.length);
    const sobra = totalCents - baseCents * equipes.length;
    const distribuicao: Record<string, string> = {};
    equipes.forEach((equipe, index) => {
      const cents = baseCents + (index === 0 ? sobra : 0);
      distribuicao[equipe.id] = formatarNumeroInput(cents / 100);
    });
    setMetasEquipe(distribuicao);
  }

  function zerarMetasEquipe() {
    setMetasEquipe({});
  }

  async function salvarMetasEquipes() {
    if (!metaMensalSelecionada) {
      toast("Salve primeiro a meta mensal desse período.", "error");
      return;
    }
    if (!metasEquipeFechadas) {
      toast(
        `A soma por equipe precisa fechar com a meta mensal. Diferença: ${brl(diferencaMetasEquipe)}.`,
        "error"
      );
      return;
    }

    setSavingMetasEquipe(true);
    try {
      const payload = equipes
        .map((equipe) => ({
          equipe_id: equipe.id,
          valor_meta: normalizarNumeroBR(metasEquipe[equipe.id] || ""),
          observacoes: null,
        }))
        .filter((item) => item.valor_meta > 0);

      const r = await fetch("/api/metas/equipes", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ano: anoSelecionado,
          mes: mesSelecionado,
          items: payload,
        }),
      });

      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast(`Erro: ${j.error ?? r.statusText}`, "error");
        return;
      }

      toast("Metas por equipe salvas.", "success");
      await carregarMetasEquipes(anoSelecionado, mesSelecionado);
    } catch (err) {
      toast(`Erro: ${(err as Error).message}`, "error");
    } finally {
      setSavingMetasEquipe(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Meta mensal</h1>
        <p className="text-sm font-bold text-[var(--color-ink-600)]">
          Define a meta de faturamento mensal usada no dashboard de todos os acessos.
        </p>
      </div>

      <Card className="p-4 md:p-5">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-[var(--color-ink-900)]">
            {editingId ? "Editar meta de faturamento" : "Definir meta de faturamento"}
          </h2>
          <p className="text-sm font-semibold text-[var(--color-ink-600)]">
            {editingId
              ? "Ajuste a meta existente e salve a alteração."
              : "Usada no dashboard para calcular % atingido e meta do próximo dia."}
          </p>
        </div>
        <form onSubmit={salvar} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            label="Ano"
            type="number"
            value={ano}
            onChange={(e) => setAno(e.target.value)}
          />
          <Select
            label="Mês"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            options={MESES.map((m, i) => ({ value: String(i + 1), label: m }))}
          />
          <Input
            label="Valor meta (R$)"
            type="text"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(limparNumeroInput(e.target.value))}
            placeholder="ex.: 1.200.000,00"
          />
          <Input
            label="Observações"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="opcional"
          />
          <div className="flex items-end">
            <Button type="submit" className="w-full" loading={saving}>
              {editingId ? "Salvar edição" : "Salvar"}
            </Button>
          </div>
        </form>
        {editingId && (
          <div className="mt-3 flex justify-end">
            <Button type="button" variant="ghost" onClick={limparFormulario}>
              Cancelar edição
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-ink-900)]">
              Meta mensal por equipe
            </h2>
            <p className="text-sm font-semibold text-[var(--color-ink-600)]">
              Distribua a meta mensal entre as frentes. A soma precisa fechar exatamente com a meta do mês.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!metaMensalSelecionada || equipes.length === 0}
              onClick={distribuirIgual}
            >
              Dividir igual
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={zerarMetasEquipe}>
              Zerar
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card-alt)] p-3">
            <p className="text-xs font-bold uppercase text-[var(--color-ink-500)]">
              Meta mensal
            </p>
            <p className="mt-1 text-lg font-bold tabular text-[var(--color-ink-900)] md:text-xl">
              {metaMensalSelecionada ? brl(valorMetaMensalSelecionada) : "sem meta"}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card-alt)] p-3">
            <p className="text-xs font-bold uppercase text-[var(--color-ink-500)]">
              Distribuído
            </p>
            <p className="mt-1 text-lg font-bold tabular text-[var(--color-gn-700)] md:text-xl">
              {brl(totalMetasEquipe)}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card-alt)] p-3">
            <p className="text-xs font-bold uppercase text-[var(--color-ink-500)]">
              Diferença
            </p>
            <p
              className={
                "mt-1 text-lg font-bold tabular md:text-xl " +
                (metasEquipeFechadas
                  ? "text-[var(--color-forest-700)]"
                  : "text-[var(--color-danger-500)]")
              }
            >
              {brl(diferencaMetasEquipe)}
            </p>
          </div>
        </div>

        {metaEquipeSetupError && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
            Tabela de metas por equipe ainda não está pronta no Supabase. Rode o SQL de migração
            <span className="font-mono"> lib/db/add_metas_equipes.sql</span>. Detalhe: {metaEquipeSetupError}
          </div>
        )}

        {!metaMensalSelecionada ? (
          <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card-alt)] p-4 text-sm font-semibold text-[var(--color-ink-600)]">
            Cadastre e salve a meta mensal de {MESES[mesSelecionado - 1]}/{anoSelecionado} antes de distribuir por equipe.
          </div>
        ) : loadingMetasEquipe ? (
          <p className="mt-4 text-sm font-semibold text-[var(--color-ink-600)]">
            Carregando metas por equipe...
          </p>
        ) : equipes.length === 0 ? (
          <p className="mt-4 text-sm font-semibold text-[var(--color-ink-600)]">
            Nenhuma equipe ativa encontrada.
          </p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {equipes.map((equipe) => (
                <Input
                  key={equipe.id}
                  label={equipe.nome}
                  type="text"
                  inputMode="decimal"
                  value={metasEquipe[equipe.id] ?? ""}
                  onChange={(e) => atualizarMetaEquipe(equipe.id, e.target.value)}
                  placeholder="0,00"
                />
              ))}
            </div>
            {!metasEquipeFechadas && (
              <p className="mt-3 text-sm font-bold text-[var(--color-danger-500)]">
                Ajuste os valores: a diferença atual é {brl(diferencaMetasEquipe)}.
              </p>
            )}
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                loading={savingMetasEquipe}
                disabled={!metasEquipeFechadas || !metaMensalSelecionada}
                onClick={salvarMetasEquipes}
              >
                Salvar metas por equipe
              </Button>
            </div>
          </>
        )}
      </Card>

      <Card>
        <div className="border-b border-[var(--color-ink-100)] p-4">
          <h2 className="text-lg font-bold text-[var(--color-ink-900)]">
            Histórico de metas mensais
          </h2>
        </div>

        {/* Mobile */}
        <div className="divide-y divide-[var(--color-ink-100)] lg:hidden">
          {items.length === 0 ? (
            <p className="p-6 text-center text-sm font-semibold text-[var(--color-ink-600)]">
              Nenhuma meta cadastrada ainda.
            </p>
          ) : (
            items.map((m) => (
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
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button type="button" variant="secondary" onClick={() => editarMeta(m)}>
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    loading={deletingId === m.id}
                    onClick={() => excluirMeta(m)}
                  >
                    Excluir
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop */}
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-ink-50)] text-left text-[var(--color-ink-500)]">
              <tr>
                <th className="px-4 py-2 font-bold">Período</th>
                <th className="px-4 py-2 text-right font-bold">Meta</th>
                <th className="px-4 py-2 font-bold">Observações</th>
                <th className="px-4 py-2 text-right font-bold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-[var(--color-ink-500)]">
                    Nenhuma meta cadastrada ainda.
                  </td>
                </tr>
              ) : (
                items.map((m) => (
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
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => editarMeta(m)}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          loading={deletingId === m.id}
                          onClick={() => excluirMeta(m)}
                        >
                          Excluir
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
