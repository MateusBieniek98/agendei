"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { brl, ddmmyyyy, num } from "@/lib/format";
import type { Equipe, Maquina, OperationalAllocation, ProjectSummary, ProjetoComTalhoes } from "@/lib/types";

type Mode = "admin" | "gestor" | "field";

function MiniChart({ points, financial }: { points: ProjectSummary["serie"]; financial: boolean }) {
  const max = Math.max(1, ...points.map((point) => point.valor));
  const width = 700;
  const height = 190;
  const path = points.map((point, index) => {
    const x = points.length <= 1 ? 0 : (index / (points.length - 1)) * width;
    const y = height - (point.valor / max) * (height - 20);
    return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  if (!financial) return <p className="text-sm text-[var(--text-muted)]">Valores financeiros são restritos à gestão.</p>;
  if (points.length === 0) return <p className="text-sm text-[var(--text-muted)]">Sem produção no período.</p>;
  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolução do valor produzido" className="h-48 w-full overflow-visible">
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="flex justify-between text-xs text-[var(--text-muted)]">
        <span>{ddmmyyyy(points[0].data)}</span><span>{ddmmyyyy(points.at(-1)!.data)}</span>
      </div>
    </div>
  );
}

export default function ProjectDashboard({ mode, initialProjectId }: { mode: Mode; initialProjectId?: string | null }) {
  const { toast } = useToast();
  const [projects, setProjects] = useState<ProjetoComTalhoes[]>([]);
  const [projectId, setProjectId] = useState(initialProjectId ?? "");
  const [plotId, setPlotId] = useState("");
  const [preset, setPreset] = useState("ciclo_atual");
  const [summary, setSummary] = useState<ProjectSummary & { financeiro_visivel?: boolean } | null>(null);
  const [teams, setTeams] = useState<Equipe[]>([]);
  const [machines, setMachines] = useState<Maquina[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allocation, setAllocation] = useState({ resource_type: "equipe", resource_id: "", talhao_id: "", observacoes: "" });
  const canManage = mode !== "field";

  useEffect(() => {
    Promise.all([
      fetch("/api/projetos?include_talhoes=1", { cache: "no-store" }).then((r) => r.json()),
      canManage ? fetch("/api/equipes").then((r) => r.json()) : Promise.resolve({ items: [] }),
      canManage ? fetch("/api/maquinas").then((r) => r.json()) : Promise.resolve({ items: [] }),
    ]).then(([projectData, teamData, machineData]) => {
      const items = Array.isArray(projectData.items) ? projectData.items as ProjetoComTalhoes[] : [];
      setProjects(items);
      setProjectId((current) => current || (mode === "gestor" ? items[0]?.id ?? "" : ""));
      setTeams(Array.isArray(teamData.items) ? teamData.items : []);
      setMachines(Array.isArray(machineData.items) ? machineData.items : []);
    }).catch((error) => toast(`Erro ao carregar catálogo: ${error.message}`, "error"));
  }, [canManage, mode, toast]);

  const load = useCallback(async () => {
    if (!projectId) { setLoading(false); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ preset });
      if (plotId) params.set("talhao_id", plotId);
      const response = await fetch(`/api/projetos/${projectId}/resumo?${params}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? response.statusText);
      setSummary(json);
    } catch (error) {
      toast(`Erro ao carregar projeto: ${(error as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  }, [plotId, preset, projectId, toast]);

  useEffect(() => { void load(); }, [load]);

  const selectedProject = projects.find((item) => item.id === projectId);
  const plots = selectedProject?.talhoes.filter((item) => item.ativo) ?? [];
  const resources = allocation.resource_type === "equipe"
    ? teams.map((item) => ({ value: item.id, label: item.nome }))
    : machines.map((item) => ({ value: item.id, label: `${item.nome}${item.identificador ? ` · ${item.identificador}` : ""}` }));

  async function saveAllocation() {
    if (!allocation.resource_id || !allocation.talhao_id) return toast("Selecione recurso e talhão.", "error");
    setSaving(true);
    try {
      const response = await fetch("/api/alocacoes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "alocar", ...allocation }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? response.statusText);
      toast("Alocação atualizada.", "success");
      setAllocation((current) => ({ ...current, resource_id: "", observacoes: "" }));
      await load();
    } catch (error) {
      toast(`Erro: ${(error as Error).message}`, "error");
    } finally { setSaving(false); }
  }

  async function closeAllocation(item: OperationalAllocation) {
    const resourceType = item.equipe_id ? "equipe" : "maquina";
    const resourceId = item.equipe_id ?? item.maquina_id;
    if (!resourceId) return;
    const response = await fetch("/api/alocacoes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "encerrar", resource_type: resourceType, resource_id: resourceId }),
    });
    if (!response.ok) return toast("Não foi possível encerrar a alocação.", "error");
    toast("Alocação encerrada.", "success");
    await load();
  }

  if (!projectId && !loading) return <Card className="p-8 text-center text-sm text-[var(--text-muted)]">Nenhum projeto disponível.</Card>;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={mode === "field" ? "Operação de campo" : "Gestão por projeto"}
        title={summary?.projeto.nome ?? "Projetos"}
        subtitle={summary ? `${summary.periodo.label} · visão integrada de produção, planejamento e recursos` : "Carregando visão operacional..."}
        right={mode === "admin" && projectId ? <Link href="/admin/projetos" className="text-sm font-medium text-[var(--accent)]">Voltar ao cadastro</Link> : undefined}
      />

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-3">
          {mode === "gestor" && <Select label="Projeto" value={projectId} onChange={(e) => { setProjectId(e.target.value); setPlotId(""); }} options={projects.map((item) => ({ value: item.id, label: item.nome }))} />}
          <Select label="Talhão" value={plotId} onChange={(e) => setPlotId(e.target.value)} options={plots.map((item) => ({ value: item.id, label: item.codigo }))} placeholder="Todos os talhões" />
          <Select label="Período" value={preset} onChange={(e) => setPreset(e.target.value)} options={[{ value: "ciclo_atual", label: "Ciclo atual" }, { value: "ciclo_anterior", label: "Ciclo anterior" }, { value: "mes_atual", label: "Mês atual" }, { value: "ultimos_30", label: "Últimos 30 dias" }]} />
        </div>
      </Card>

      {loading && !summary ? <Card className="p-10 text-center text-sm text-[var(--text-muted)]">Carregando indicadores...</Card> : summary && <>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          <StatCard label="Área cadastrada" value={`${num(summary.kpis.area_total_ha, 1)} ha`} hint={`${summary.kpis.talhoes_ativos} talhões ativos`} />
          <StatCard label="Produção" value={summary.financeiro_visivel ? brl(summary.kpis.producao_valor) : summary.kpis.lancamentos} hint={summary.financeiro_visivel ? `${summary.kpis.lancamentos} apontamentos` : "apontamentos no período"} />
          <StatCard label="Planejamentos" value={summary.kpis.planejamentos} hint={`${summary.kpis.planejamentos_concluidos} concluídos`} />
          <StatCard label="Atrasados" value={summary.kpis.planejamentos_atrasados} tone={summary.kpis.planejamentos_atrasados ? "danger" : "positive"} />
          <StatCard label="Manutenções abertas" value={summary.kpis.manutencoes_abertas} tone={summary.kpis.manutencoes_abertas ? "warning" : "positive"} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <Card><CardHeader title="Evolução da produção" subtitle={summary.periodo.label} /><CardBody><MiniChart points={summary.serie} financial={!!summary.financeiro_visivel} /></CardBody></Card>
          <Card><CardHeader title="Planejado × realizado" subtitle="Por atividade" /><CardBody className="space-y-4">
            {summary.por_atividade.length === 0 ? <p className="text-sm text-[var(--text-muted)]">Sem atividades no período.</p> : summary.por_atividade.slice(0, 8).map((item) => {
              const pct = item.previsto > 0 ? Math.min(100, item.realizado / item.previsto * 100) : 0;
              return <div key={item.atividade_id}><div className="mb-1 flex justify-between gap-3 text-xs"><span className="truncate font-medium text-[var(--text-primary)]">{item.nome}</span><span className="text-[var(--text-muted)]">{num(item.realizado, 1)} / {num(item.previsto, 1)} {item.unidade}</span></div><div className="h-2 rounded-full bg-[var(--bg-active)]"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} /></div></div>;
            })}
          </CardBody></Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card><CardHeader title="Talhões" subtitle="Comparação operacional" /><CardBody className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm"><thead className="text-left text-xs text-[var(--text-muted)]"><tr><th className="pb-3">Talhão</th><th className="pb-3">Área</th><th className="pb-3">Apontamentos</th><th className="pb-3">Planejamentos</th><th className="pb-3">Manutenção</th></tr></thead><tbody>{summary.talhoes.map((item) => <tr key={item.id} className="border-t border-[var(--divider)]"><td className="py-3 font-medium">{item.codigo}</td><td>{item.area_ha == null ? "—" : `${num(item.area_ha, 1)} ha`}</td><td>{item.lancamentos}</td><td>{item.planejamentos}</td><td>{item.manutencoes_abertas}</td></tr>)}</tbody></table></CardBody></Card>
          <Card><CardHeader title="Alocações atuais" subtitle={`${summary.kpis.equipes_alocadas} equipes · ${summary.kpis.maquinas_alocadas} máquinas`} /><CardBody className="space-y-2">{summary.alocacoes.length === 0 ? <p className="text-sm text-[var(--text-muted)]">Nenhum recurso alocado neste projeto.</p> : summary.alocacoes.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{item.equipes?.nome ?? item.maquinas?.nome ?? "Recurso"}</p><p className="text-xs text-[var(--text-muted)]">Talhão {item.talhoes?.codigo ?? "—"}</p></div>{canManage && <Button variant="ghost" size="sm" onClick={() => void closeAllocation(item)}>Encerrar</Button>}</div>)}</CardBody></Card>
        </div>

        {canManage && <Card><CardHeader title="Nova alocação operacional" subtitle="A nova alocação encerra automaticamente a posição anterior do recurso." /><CardBody><div className="grid gap-3 md:grid-cols-4 md:items-end"><Select label="Tipo" value={allocation.resource_type} onChange={(e) => setAllocation({ resource_type: e.target.value, resource_id: "", talhao_id: allocation.talhao_id, observacoes: allocation.observacoes })} options={[{ value: "equipe", label: "Equipe" }, { value: "maquina", label: "Máquina" }]} /><Select label="Recurso" value={allocation.resource_id} onChange={(e) => setAllocation({ ...allocation, resource_id: e.target.value })} options={resources} placeholder="Selecione" /><Select label="Talhão" value={allocation.talhao_id} onChange={(e) => setAllocation({ ...allocation, talhao_id: e.target.value })} options={plots.map((item) => ({ value: item.id, label: item.codigo }))} placeholder="Selecione" /><Button onClick={() => void saveAllocation()} loading={saving}>Alocar</Button></div></CardBody></Card>}
      </>}
    </div>
  );
}
