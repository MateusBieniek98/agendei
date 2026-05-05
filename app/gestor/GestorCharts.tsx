"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { brl, ddmmyyyy } from "@/lib/format";

export function LinhaChart({
  serie,
}: {
  serie: { data: string; faturamento: number }[];
}) {
  const data = serie.map((s) => ({
    ...s,
    label: ddmmyyyy(s.data).slice(0, 5), // dd/mm
    faturamento: Number(s.faturamento ?? 0),
  }));
  return (
    <div className="h-64 w-full mt-3">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="gnGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2f80ed" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#2f80ed" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v) =>
              v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
            }
          />
          <Tooltip formatter={(v: number) => brl(v)} labelFormatter={(l) => `Dia ${l}`} />
          <Area
            type="monotone"
            dataKey="faturamento"
            stroke="#1d6cdc"
            strokeWidth={2}
            fill="url(#gnGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
