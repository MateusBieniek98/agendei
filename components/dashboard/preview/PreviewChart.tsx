import { useEffect, useRef, useState } from "react";
import { brl, num } from "@/lib/format";
import type { PreviewSummary } from "@/lib/management-preview";
import styles from "./ManagementPreview.module.css";

type Metric = "cumulative" | "value" | "area";

export default function PreviewChart({ summary }: { summary: PreviewSummary }) {
  const [metric, setMetric] = useState<Metric>("cumulative");
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(700);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(250, entry.contentRect.width)));
    observer.observe(container.current!);
    return () => observer.disconnect();
  }, []);
  const { series } = summary;
  const isArea = metric === "area";
  const ceiling = Math.max(1, ...series.map((point) => point[metric] ?? 0), ...(metric === "cumulative" ? [summary.target] : [])) * 1.12;
  const x = (day: number) => 55 + (day - 1) / (series.length - 1) * (width - 75);
  const y = (value: number) => 214 - value / ceiling * 190;
  const points = series.filter((point) => point[metric] !== null);
  const line = points.map((point, index) => `${index ? "L" : "M"}${x(point.day)},${y(point[metric]!)}`).join(" ");
  const last = points.at(-1);
  const first = points[0];
  const label = isArea ? "Área realizada" : metric === "value" ? "Faturamento diário" : "Faturamento acumulado";
  const activePoint = series.find((point) => point.day === hoveredDay);

  return (
    <>
      <div className={styles.panelHeading}>
        <div><h2>Evolução do mês</h2><p>Realizado e meta da competência</p></div>
        <div className={styles.segmented} role="group" aria-label="Visualização do gráfico">
          {([ ["cumulative", "Acumulado"], ["value", "Diário"], ["area", "Área (ha)"] ] as const).map(([value, text]) => (
            <button key={value} type="button" aria-pressed={metric === value} onClick={() => { setMetric(value); setHoveredDay(null); }}>{text}</button>
          ))}
        </div>
      </div>
      <div ref={container} className={styles.chart}>
        <svg viewBox={`0 0 ${width} 245`} role="img" aria-label={`${label} de demonstração. ${isArea ? num(summary.area) + " hectares" : brl(summary.produced)} no período.`}>
          <defs><linearGradient id="preview-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2f7455" stopOpacity=".17" /><stop offset="100%" stopColor="#2f7455" stopOpacity=".01" /></linearGradient></defs>
          {[0, 1, 2, 3, 4].map((index) => {
            const value = ceiling * index / 4;
            return <g key={index}><line x1="55" y1={y(value)} x2={width - 20} y2={y(value)} stroke="#e4eae7" strokeDasharray="3 5" /><text x="43" y={y(value) + 4} textAnchor="end">{value >= 1000 ? `${num(value / 1000, 0)} mil` : num(value, 0)}</text></g>;
          })}
          {metric === "cumulative" && <path d={series.map((point, index) => `${index ? "L" : "M"}${x(point.day)},${y(point.target)}`).join(" ")} fill="none" stroke="#b3c9bc" strokeWidth="2" strokeDasharray="5 5" />}
          {first && last && metric !== "value" && <path d={`${line} L${x(last.day)},214 L${x(first.day)},214 Z`} fill="url(#preview-chart-fill)" />}
          {metric !== "value" && <path d={line} fill="none" stroke="#235f46" strokeWidth="2.8" strokeLinejoin="round" strokeLinecap="round" />}
          {points.map((point) => <g key={point.day}>
            {metric === "value" ? <rect x={x(point.day) - (width < 450 ? 2.5 : 5)} y={y(point.value!)} width={width < 450 ? 5 : 10} height={Math.max(0, 214 - y(point.value!))} rx="2" fill="#508b69" /> : <circle cx={x(point.day)} cy={y(point[metric]!)} r={width < 450 ? 2 : 3} fill="#235f46" />}
            <rect x={x(point.day) - 9} y="16" width="18" height="200" fill="transparent" onMouseEnter={() => setHoveredDay(point.day)} onMouseLeave={() => setHoveredDay(null)} />
          </g>)}
          {[1, 5, 10, 15, 20, 25, series.length].map((day) => <text key={day} x={x(day)} y="237" textAnchor="middle">{String(day).padStart(2, "0")}</text>)}
        </svg>
        {activePoint && <div className={styles.chartTooltip}>Dia {String(activePoint.day).padStart(2, "0")} · {isArea ? `${num(activePoint.area)} ha` : brl(activePoint[metric])}</div>}
        {!first && <div className={styles.chartEmpty}>Nenhum lançamento nesse período.</div>}
      </div>
      <div className={styles.chartFooter}><span>{isArea ? "Hectares e horas são contabilizados separadamente." : <>Meta atingida: <strong>{num(summary.progress, 1)}%</strong></>}</span><div className={styles.legend}><span><i />Realizado</span>{metric === "cumulative" && <span><i className={styles.targetLegend} />Meta geral</span>}</div></div>
    </>
  );
}
