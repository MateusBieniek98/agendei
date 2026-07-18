"use client";

import {
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from "recharts";
import { brl, ddmmyyyy } from "@/lib/format";

/** Calcula a linha de tendência (regressão linear simples) */
function tendencia(serie: { faturamento: number }[]): (number | null)[] {
  const n = serie.length;
  if (n < 2) return serie.map(() => null);
  const xs = serie.map((_, i) => i);
  const ys = serie.map((s) => s.faturamento);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const slope = den ? num / den : 0;
  const intercept = my - slope * mx;
  return xs.map((x) => Math.max(0, slope * x + intercept));
}

export function LinhaChart({
  serie,
  mediaDia,
  className = "mt-3 h-64 w-full",
}: {
  serie: { data: string; faturamento: number }[];
  mediaDia?: number;
  className?: string;
}) {
  const trend = tendencia(serie);

  const data = serie.map((s, i) => ({
    ...s,
    label: ddmmyyyy(s.data).slice(0, 5),
    faturamento: Number(s.faturamento ?? 0),
    tendencia: trend[i] != null ? Number(trend[i]!.toFixed(2)) : null,
  }));

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 12, right: 12, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="gnGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.26} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.015} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--divider)" strokeDasharray="2 4" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
          />
          <Tooltip
            contentStyle={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text-primary)",
              fontSize: 12,
              boxShadow: "0 12px 28px rgba(15, 23, 42, 0.14)",
            }}
            formatter={(v: number, name: string) => [
              brl(v),
              name === "faturamento" ? "Realizado" : "Tendência",
            ]}
            labelFormatter={(l) => `Dia ${l}`}
          />

          {/* Média diária como linha de referência */}
          {mediaDia && mediaDia > 0 && (
            <ReferenceLine
              y={mediaDia}
              stroke="var(--warn)"
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={{ value: "Média", position: "insideTopRight", fontSize: 10, fill: "var(--warn)" }}
            />
          )}

          {/* Área de produção */}
          <Area
            type="monotone"
            dataKey="faturamento"
            stroke="var(--accent)"
            strokeWidth={2.25}
            fill="url(#gnGrad)"
            dot={false}
            activeDot={{ r: 5, fill: "var(--accent)" }}
          />

          {/* Linha de tendência pontilhada */}
          <Line
            type="monotone"
            dataKey="tendencia"
            stroke="var(--success)"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            activeDot={false}
          />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legenda */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1">
        <LegendItem color="var(--accent)" label="Realizado" />
        <LegendItem color="var(--success)" label="Tendência" dashed />
        {mediaDia && mediaDia > 0 && (
          <LegendItem color="var(--warn)" label="Média/dia" dashed />
        )}
      </div>
    </div>
  );
}

function LegendItem({
  color,
  label,
  dashed = false,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
      <span
        className="inline-block h-0.5 w-5 rounded"
        style={{
          background: dashed ? "transparent" : color,
          borderTop: dashed ? `2px dashed ${color}` : "none",
          marginTop: dashed ? "1px" : "0",
        }}
      />
      {label}
    </div>
  );
}
