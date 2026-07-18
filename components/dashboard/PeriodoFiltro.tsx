"use client";

import { useEffect, useState } from "react";
import {
  PRESETS,
  diasUteisPeriodo,
  type PeriodoPreset,
  resolvePreset,
} from "@/lib/period";
import { ddmmyyyy } from "@/lib/format";

export type PeriodoState = {
  preset: PeriodoPreset;
  de?: string;
  ate?: string;
};

export default function PeriodoFiltro({
  value,
  onChange,
  loading,
}: {
  value: PeriodoState;
  onChange: (v: PeriodoState) => void;
  loading?: boolean;
}) {
  const [info, setInfo] = useState<{
    de: string;
    ate: string;
    diasTotais: number;
    diasUteis: number;
  } | null>(null);
  const [customDe, setCustomDe] = useState(value.de ?? "");
  const [customAte, setCustomAte] = useState(value.ate ?? "");

  useEffect(() => {
    if (value.preset === "custom") {
      if (value.de && value.ate) {
        const p = resolvePreset("custom", { de: value.de, ate: value.ate });
        setInfo({
          de: p.de,
          ate: p.ate,
          diasTotais: p.diasTotais,
          diasUteis: diasUteisPeriodo(p),
        });
      }
    } else {
      const p = resolvePreset(value.preset);
      setInfo({
        de: p.de,
        ate: p.ate,
        diasTotais: p.diasTotais,
        diasUteis: diasUteisPeriodo(p),
      });
    }
  }, [value.preset, value.de, value.ate]);

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:flex-wrap">
        <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Período
        </label>
        <select
          value={value.preset}
          onChange={(e) =>
            onChange({ ...value, preset: e.target.value as PeriodoPreset })
          }
          className="h-9 w-full rounded-md border px-3 text-sm font-normal md:w-auto"
          style={{
            background: "var(--bg-input)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
          }}
        >
          {Object.entries(PRESETS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>

        {value.preset === "custom" && (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <input
              type="date"
              value={customDe}
              onChange={(e) => setCustomDe(e.target.value)}
              onBlur={() => {
                if (customDe && customAte) {
                  onChange({ preset: "custom", de: customDe, ate: customAte });
                }
              }}
              className="h-9 min-w-0 rounded-md border px-3 text-sm font-normal"
              style={{
                background: "var(--bg-input)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            />
            <span className="font-medium" style={{ color: "var(--text-secondary)" }}>→</span>
            <input
              type="date"
              value={customAte}
              onChange={(e) => setCustomAte(e.target.value)}
              onBlur={() => {
                if (customDe && customAte) {
                  onChange({ preset: "custom", de: customDe, ate: customAte });
                }
              }}
              className="h-9 min-w-0 rounded-md border px-3 text-sm font-normal"
              style={{
                background: "var(--bg-input)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </div>
        )}
      </div>

      <div
        className="flex items-center gap-3 text-xs font-normal tabular"
        style={{ color: "var(--text-secondary)" }}
      >
        {info && (
          <>
            <span>
              {ddmmyyyy(info.de)} → {ddmmyyyy(info.ate)} · {info.diasTotais} dias ·{" "}
              {info.diasUteis} úteis
            </span>
          </>
        )}
        {loading && (
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-full border-2 border-[var(--color-gn-500)] border-t-transparent animate-spin" />
            atualizando…
          </span>
        )}
      </div>
    </div>
  );
}
