"use client";

import { useMemo, useState } from "react";
import Logo from "@/components/branding/Logo";
import NavigationIcon from "@/components/nav/NavigationIcon";
import type { NavigationIconName } from "@/components/nav/navigation";
import { brl, ddmmyyyy, num } from "@/lib/format";
import { PRODUCT_BRAND } from "@/lib/product-brand";
import { PREVIEW_COMPETENCES, PREVIEW_RECORDS, defaultPreviewFilters, summarizePreview, type PreviewFilters, type PreviewRecord } from "@/lib/management-preview";
import PreviewChart from "./PreviewChart";
import PreviewDialog from "./PreviewDialog";
import styles from "./ManagementPreview.module.css";

type Dialog = "details" | "goal" | "agenda" | "criteria" | null;
type DetailMode = "all" | "current" | "pending" | "pointed" | "retroactive";
const DETAIL_TITLES: Record<DetailMode, string> = {
  all: "Lançamentos", current: "Realizado no período", pending: "Pendências no SGF", pointed: "Apontamentos no SGF", retroactive: "Valores retroativos",
};
const OPTIONS = {
  farm: [...new Set(PREVIEW_RECORDS.map((row) => row.farm))].sort(),
  activity: [...new Set(PREVIEW_RECORDS.map((row) => row.activity))].sort(),
  person: [...new Set(PREVIEW_RECORDS.map((row) => row.person))].sort(),
};

function exportCSV(rows: PreviewRecord[]) {
  const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const content = [
    ["Demonstração: dados fictícios"],
    ["Lançamento", "Realização", "Fazenda", "Talhão", "Equipe", "Atividade", "Quantidade", "Unidade", "Valor", "Apontado", "Situação"],
    ...rows.map((row) => [row.date, row.performedOn, row.farm, row.plot, row.person, row.activity, row.quantity, row.unit, row.value.toFixed(2), row.pointed.toFixed(2), row.status]),
  ].map((row) => row.map(quote).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "talhivo-demonstracao.csv";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function SelectFilter({ label, value, options, all, onChange }: {
  label: string; value: string; options: string[]; all: string; onChange: (value: string) => void;
}) {
  return <label className={styles.field}><span>{label}</span><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}><option value="">{all}</option>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

export default function ManagementPreview() {
  const [filters, setFilters] = useState(defaultPreviewFilters);
  const [targets, setTargets] = useState<Record<string, number>>({ "2026-10": 425000, "2026-09": 390000 });
  const [rankBy, setRankBy] = useState<"farm" | "person">("farm");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [detailMode, setDetailMode] = useState<DetailMode>("all");
  const [search, setSearch] = useState("");
  const [goalDraft, setGoalDraft] = useState("425000");
  const [presenting, setPresenting] = useState(false);
  const target = targets[filters.competence];
  const summary = useMemo(() => summarizePreview(PREVIEW_RECORDS, filters, target), [filters, target]);
  const month = PREVIEW_COMPETENCES.find((item) => item.value === filters.competence)!;
  const monthEnd = `${filters.competence}-${new Date(Number(filters.competence.slice(0, 4)), Number(filters.competence.slice(5)), 0).getDate()}`;
  const invalidPeriod = !filters.from || !filters.to || filters.from > filters.to;
  const filtered = Boolean(filters.farm || filters.activity || filters.person || filters.status || filters.from !== `${filters.competence}-01` || filters.to !== `${filters.competence}-28`);
  const ranks = rankBy === "farm" ? summary.farms : summary.people;
  const detailRows = summary.rows.filter((row) =>
    (detailMode !== "current" || !row.retroactive) &&
    (detailMode !== "pending" || row.pointed < row.value) &&
    (detailMode !== "pointed" || row.pointed > 0) &&
    (detailMode !== "retroactive" || row.retroactive) &&
    `${row.farm} ${row.plot} ${row.person} ${row.activity} ${row.status}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")),
  );
  const agenda = ["A", "B", "C"].map((letter, index) => ({
    farm: `Fazenda Modelo ${letter}`, person: `Equipe ${["Alfa", "Beta", "Gama"][index]}`, plot: `T-0${index + 1}`,
    stage: [15, 25, 31][index],
    date: new Date(Date.UTC(Number(filters.competence.slice(0, 4)), Number(filters.competence.slice(5)), 3 + index * 3, 12)).toISOString().slice(0, 10),
  })).filter((event) => (!filters.farm || event.farm === filters.farm) && (!filters.person || event.person === filters.person));

  function updateFilter(key: keyof PreviewFilters, value: string) {
    setFilters((previous) => ({ ...previous, [key]: value }));
  }

  function showDetails(mode: DetailMode = "all") {
    setDetailMode(mode); setSearch(""); setDialog("details");
  }

  function showGoal() { setGoalDraft(String(target)); setDialog("goal"); }

  const kpis: { label: string; value: number; subtitle: string; icon: NavigationIconName; action: () => void; featured?: boolean; warning?: boolean }[] = [
    { label: "Realizado no período", value: summary.produced, subtitle: `${num(summary.area)} ha · ${summary.rows.filter((row) => !row.retroactive).length} lançamentos`, icon: "chart", action: () => showDetails("current"), featured: true },
    { label: "Apontado no SGF", value: summary.pointed, subtitle: "Valor já apontado na competência", icon: "list", action: () => showDetails("pointed") },
    { label: "Falta apontar no SGF", value: summary.pending, subtitle: `${summary.rows.filter((row) => row.pointed < row.value).length} lançamentos com saldo pendente`, icon: "sync", action: () => showDetails("pending"), warning: true },
    { label: "Valor retroativo", value: summary.retroactive, subtitle: `Total geral: ${brl(summary.total)}`, icon: "calendar", action: () => showDetails("retroactive") },
    { label: "Projeção de fechamento", value: summary.projection, subtitle: "Estimativa pelo ritmo do período", icon: "target", action: () => setDialog("criteria") },
    { label: "Ritmo por dia útil", value: summary.pace, subtitle: `${num(summary.elapsedDays)} dias úteis no recorte`, icon: "chart", action: () => setDialog("criteria") },
  ];

  return (
    <main id="visao-geral" className={`${styles.preview} ${presenting ? styles.presenting : ""}`}>
      <div className={styles.topline}>
        <div className={styles.brand}><Logo size={32} /><span>{PRODUCT_BRAND.shortName}</span><span className={styles.brandDivider}>/</span><span className={styles.areaName}>Gestão operacional</span></div>
        <span className={styles.demoBadge}><span />Prévia · Dados fictícios</span>
      </div>

      <header className={styles.header}>
        <div><span className={styles.eyebrow}>VISÃO DA OPERAÇÃO</span><h1>Operações e faturamento</h1><p>Produção, apontamentos e metas em um só lugar.</p></div>
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={() => showDetails("pending")}><NavigationIcon name="list" /><span>Resumo SGF</span></button>
          <button type="button" className={styles.button} onClick={() => showDetails()}><NavigationIcon name="package" /><span>Lançamentos</span></button>
          <button type="button" className={styles.button} onClick={() => exportCSV(summary.rows)} disabled={!summary.rows.length}><span aria-hidden>↓</span><span>Exportar CSV</span></button>
          <button type="button" className={`${styles.button} ${styles.primaryButton}`} aria-pressed={presenting} onClick={() => setPresenting(!presenting)}><NavigationIcon name="dashboard" /><span>{presenting ? "Sair da apresentação" : "Apresentar"}</span></button>
        </div>
      </header>

      <section className={styles.filters} aria-label="Filtros do painel">
        <label className={styles.field}><span>Competência</span><select aria-label="Competência" value={filters.competence} onChange={(event) => setFilters(defaultPreviewFilters(event.target.value))}>{PREVIEW_COMPETENCES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <fieldset className={styles.period}><legend>Período de lançamento</legend><div><input type="date" aria-label="De" min={`${filters.competence}-01`} max={monthEnd} value={filters.from} onChange={(event) => { if (event.target.value) updateFilter("from", event.target.value); }} /><span>até</span><input type="date" aria-label="Até" min={`${filters.competence}-01`} max={monthEnd} value={filters.to} onChange={(event) => { if (event.target.value) updateFilter("to", event.target.value); }} /></div></fieldset>
        <SelectFilter label="Fazenda" all="Todas as fazendas" value={filters.farm} options={OPTIONS.farm} onChange={(value) => updateFilter("farm", value)} />
        <SelectFilter label="Atividade" all="Todas as atividades" value={filters.activity} options={OPTIONS.activity} onChange={(value) => updateFilter("activity", value)} />
        <SelectFilter label="Encarregado" all="Todas as equipes" value={filters.person} options={OPTIONS.person} onChange={(value) => updateFilter("person", value)} />
        <SelectFilter label="Situação SGF" all="Todas" value={filters.status} options={["Apontado", "Pendente", "Parcial"]} onChange={(value) => updateFilter("status", value)} />
        <button type="button" className={styles.reset} onClick={() => setFilters(defaultPreviewFilters(filters.competence))}><NavigationIcon name="sync" />Limpar</button>
      </section>

      {invalidPeriod && <p className={styles.warning} role="alert">A data inicial deve ser anterior ou igual à data final.</p>}
      <div className={styles.sectionLine}><span>{month.label}<span className={styles.dot}>·</span>{ddmmyyyy(filters.from).slice(0, 5)} a {ddmmyyyy(filters.to).slice(0, 5)}</span><span role="status" aria-live="polite">{summary.rows.length} lançamentos{filtered ? " · Recorte filtrado" : " · Visão geral"}</span></div>

      <section className={styles.kpis} aria-label="Indicadores do período">
        {kpis.map((kpi) => <button key={kpi.label} type="button" className={`${styles.kpi} ${kpi.featured ? styles.featured : ""} ${kpi.warning ? styles.pendingKpi : ""}`} onClick={kpi.action} aria-label={`${kpi.label}: ${brl(kpi.value)}. Ver detalhes`}>
          <span className={styles.kpiLabel}>{kpi.label}<NavigationIcon name={kpi.icon} /></span><strong className={styles.kpiValue}>{brl(kpi.value)}</strong><span className={styles.kpiSubtitle}>{kpi.subtitle}</span>
        </button>)}
      </section>

      <section className={styles.progressStrip} aria-label="Acompanhamento da meta">
        <div className={styles.goalMain}><span className={styles.miniLabel}>Meta geral da competência</span><strong>{brl(target)}</strong><div className={styles.progressTrack}><span style={{ width: `${Math.min(100, summary.progress)}%` }} /></div></div>
        <div><span className={styles.miniLabel}>Atingido no recorte</span><strong>{num(summary.progress, 1)}%</strong></div>
        <div><span className={styles.miniLabel}>Falta para a meta</span><strong>{brl(Math.max(0, target - summary.produced))}</strong></div>
        <div><span className={styles.miniLabel}>Necessário por dia</span><strong>{brl(summary.neededPerDay)}</strong></div>
        <button type="button" className={styles.textButton} onClick={showGoal}><NavigationIcon name="target" />Simular meta <span aria-hidden>↗</span></button>
      </section>

      <div className={styles.dashboard}>
        <section className={`${styles.panel} ${styles.activities}`} aria-labelledby="activities-title">
          <div className={styles.panelHeading}><div><h2 id="activities-title">Atividades realizadas</h2><p>Total geral e saldo a apontar, por atividade</p></div><span className={styles.countBadge}>{summary.activities.filter((activity) => activity.count).length} atividades</span></div>
          <div className={styles.activityTableWrap}><table className={styles.activityTable}><thead><tr><th>Atividade</th><th>Quantidade</th><th>Total geral</th><th className={styles.pendingColumn}>Pendente SGF</th></tr></thead><tbody>
            {summary.activities.filter((activity) => activity.count).map((activity) => <tr key={activity.name} className={filters.activity === activity.name ? styles.selectedRow : ""}>
              <td><button type="button" onClick={() => updateFilter("activity", filters.activity === activity.name ? "" : activity.name)}><span className={styles.activitySymbol}><NavigationIcon name={activity.unit === "h" ? "user" : "service"} /></span><span>{activity.name}</span></button></td>
              <td>{num(activity.quantity)} <small>{activity.unit}</small></td><td>{brl(activity.value)}</td><td className={styles.pendingColumn}>{brl(activity.pending)}</td>
            </tr>)}
          </tbody></table></div>
          {!summary.rows.length && <div className={styles.empty}><NavigationIcon name="list" /><strong>Nenhum lançamento encontrado</strong><span>Experimente outro período ou limpe os filtros.</span><button type="button" className={styles.textButton} onClick={() => setFilters(defaultPreviewFilters(filters.competence))}>Limpar filtros →</button></div>}
          <div className={styles.panelFooter}><span>Hectares e horas em unidades separadas.</span><button type="button" className={styles.textButton} onClick={() => showDetails()}>Detalhar <span aria-hidden>↗</span></button></div>
        </section>

        <div className={styles.rightGrid}>
          <section className={`${styles.panel} ${styles.chartPanel}`} aria-label="Evolução da produção"><PreviewChart summary={summary} /></section>
          <div className={styles.bottomGrid}>
            <section className={`${styles.panel} ${styles.rankingPanel}`} aria-labelledby="ranking-title">
              <div className={styles.panelHeading}><div><h2 id="ranking-title">Fazendas e equipe</h2><p>Faturamento · clique para filtrar</p></div><div className={styles.segmented} role="group" aria-label="Agrupar ranking"><button type="button" aria-pressed={rankBy === "farm"} onClick={() => setRankBy("farm")}>Fazendas</button><button type="button" aria-pressed={rankBy === "person"} onClick={() => setRankBy("person")}>Equipe</button></div></div>
              <div className={styles.ranks}>{ranks.map((rank, index) => <button type="button" key={rank.name} className={styles.rankRow} onClick={() => updateFilter(rankBy, filters[rankBy] === rank.name ? "" : rank.name)} aria-pressed={filters[rankBy] === rank.name}><span className={styles.rankNumber}>{String(index + 1).padStart(2, "0")}</span><span className={styles.rankContent}><span className={styles.rankLabel}><span>{rank.name}</span><strong>{brl(rank.value)}</strong></span><span className={styles.rankTrack}><span style={{ width: `${ranks[0].value ? rank.value / ranks[0].value * 100 : 0}%` }} /></span></span></button>)}{!ranks.length && <p className={styles.emptySmall}>Sem valores nesse recorte.</p>}</div>
              <div className={styles.panelFooter}><span>{rankBy === "farm" ? "Produção por fazenda" : "Produção por equipe"}</span><span className={styles.subtleTag}>Demonstração</span></div>
            </section>
            <section className={`${styles.panel} ${styles.agendaPanel}`} aria-labelledby="agenda-title">
              <div className={styles.panelHeading}><div><h2 id="agenda-title">Agenda de sobrevivência</h2><p>Próximos marcos do plantio</p></div><span className={styles.agendaIcon}><NavigationIcon name="calendar" /></span></div>
              <div className={styles.agendaSummary}><strong>{agenda.length}</strong><span>avaliações de exemplo<br />no próximo mês</span><span className={styles.agendaStatus}>Programadas</span></div>
              <div className={styles.agendaList}>{agenda.map((event) => <button key={event.farm} type="button" className={styles.agendaRow} onClick={() => setDialog("agenda")}><span><strong>{event.farm}</strong><small>{event.plot} · {event.person}</small></span><span className={styles.stage}>{event.stage} dias</span><time dateTime={event.date}>{ddmmyyyy(event.date).slice(0, 5)}</time></button>)}{!agenda.length && <p className={styles.emptySmall}>Nenhum marco para essa combinação de fazenda e equipe.</p>}</div>
              <div className={styles.panelFooter}><span>Agenda ilustrativa</span><button type="button" className={styles.textButton} onClick={() => setDialog("agenda")}>Ver agenda <span aria-hidden>↗</span></button></div>
            </section>
          </div>
        </div>
      </div>

      <footer className={styles.footer}><span><span className={styles.footerDot} />Ambiente de demonstração · Nenhum dado operacional real</span><button type="button" onClick={() => setDialog("criteria")}>ⓘ Critérios de leitura</button></footer>

      {dialog && <PreviewDialog title={dialog === "details" ? DETAIL_TITLES[detailMode] : dialog === "goal" ? "Simular meta mensal" : dialog === "agenda" ? "Agenda de sobrevivência" : "Critérios de leitura"} description={`${month.label} · Valores e registros fictícios para avaliação da interface.`} onClose={() => setDialog(null)}>
        {dialog === "details" && <>
          <div className={styles.dialogTools}><label className={styles.search}><NavigationIcon name="list" /><input type="search" aria-label="Buscar lançamentos" placeholder="Buscar fazenda, atividade, talhão ou equipe…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><button type="button" className={styles.button} disabled={!detailRows.length} onClick={() => exportCSV(detailRows)}>↓ CSV da seleção</button></div>
          <div className={styles.detailTableWrap}><table className={styles.detailTable}><thead><tr><th>Lançamento</th><th>Realização</th><th>Fazenda / talhão</th><th>Atividade / equipe</th><th>Quantidade</th><th>Valor</th><th>Apontado</th><th>Situação</th></tr></thead><tbody>{detailRows.map((row) => <tr key={row.id}><td>{ddmmyyyy(row.date)}</td><td>{ddmmyyyy(row.performedOn)}{row.retroactive && <small>Retroativo</small>}</td><td>{row.farm}<small>{row.plot}</small></td><td>{row.activity}<small>{row.person}</small></td><td>{num(row.quantity)} {row.unit}</td><td>{brl(row.value)}</td><td>{brl(row.pointed)}</td><td><span className={`${styles.statusPill} ${row.status !== "Apontado" ? styles.statusPending : ""}`}>{row.status}</span></td></tr>)}</tbody></table>{!detailRows.length && <p className={styles.emptySmall}>Nenhum lançamento encontrado.</p>}</div>
          <div className={styles.dialogFooter}><span>{detailRows.length} lançamentos · Dados fictícios</span><strong>Total {detailMode === "pointed" ? "apontado" : detailMode === "pending" ? "pendente" : "selecionado"}: {brl(detailRows.reduce((sum, row) => sum + (detailMode === "pointed" ? row.pointed : detailMode === "pending" ? row.value - row.pointed : row.value), 0))}</strong></div>
        </>}
        {dialog === "goal" && <form className={styles.goalForm} onSubmit={(event) => { event.preventDefault(); const value = Number(goalDraft); if (value > 0 && Number.isFinite(value)) { setTargets((previous) => ({ ...previous, [filters.competence]: value })); setDialog(null); } }}><p>Explore como uma nova meta muda o atingimento e o valor necessário por dia. A simulação vale somente nesta prévia.</p><label className={styles.field}><span>Meta mensal (R$)</span><input type="number" min="0.01" max="1000000000" step="0.01" required value={goalDraft} onChange={(event) => setGoalDraft(event.target.value)} /></label><div className={styles.goalComparison}><span>Realizado no recorte<strong>{brl(summary.produced)}</strong></span><span>Atingimento simulado<strong>{Number(goalDraft) > 0 ? `${num(summary.produced / Number(goalDraft) * 100, 1)}%` : "—"}</strong></span></div><button type="submit" className={`${styles.button} ${styles.primaryButton}`}>Aplicar na prévia →</button></form>}
        {dialog === "agenda" && <div className={styles.agendaDialog}>{agenda.map((event) => <div key={event.farm}><span className={styles.agendaDate}>{ddmmyyyy(event.date).slice(0, 5)}</span><div><strong>{event.farm} · {event.plot}</strong><p>Avaliação de {event.stage} dias · {event.person}</p></div><span className={styles.statusPill}>Programada</span></div>)}{!agenda.length && <p>Nenhum marco para a fazenda e equipe selecionadas.</p>}<p className={styles.note}>Datas ilustrativas. A agenda acompanha os filtros de fazenda e encarregado.</p></div>}
        {dialog === "criteria" && <div className={styles.criteria}><div><h3>Realizado e retroativos</h3><p>Realizado considera serviços da competência. Retroativos são lançamentos de serviços realizados anteriormente. O total geral reúne os dois; o filtro de datas considera a data do lançamento.</p></div><div><h3>Apontamentos no SGF</h3><p>O saldo pendente é o total geral menos o valor apontado. O filtro “Pendente” também inclui registros parcialmente apontados.</p></div><div><h3>Ritmo, projeção e meta</h3><p>O ritmo divide o realizado pelos dias úteis do recorte, até o dia 28 da base de exemplo. A projeção multiplica esse ritmo pelos dias úteis do mês. A meta é geral e não muda com os filtros; a projeção é uma estimativa, não um fechamento.</p></div><div><h3>Gráfico e unidades</h3><p>O gráfico de realizado exclui retroativos. A linha da meta é distribuída pelos dias corridos. Hectares e horas são apresentados separadamente; a visualização de área soma apenas hectares.</p></div><div><h3>Dados de demonstração</h3><p>Todos os nomes, lançamentos e valores são fictícios. Esta prévia não importa planilhas nem consulta ou altera dados operacionais. Simulações são descartadas ao recarregar a página.</p></div></div>}
      </PreviewDialog>}
    </main>
  );
}
