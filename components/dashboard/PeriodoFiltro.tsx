"use client";

import { useEffect, useState } from "react";
import { PRESETS, type PeriodoPreset, resolvePreset } from "@/lib/period";
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
  const [info, setInfo] = useState<{ de: string; ate: string; diasTotais: number } | null>(
    null
  );
  const [customDe, setCustomDe] = useState(value.de ?? "");
  const [customAte, setCustomAte] = useState(value.ate ?? "");

  useEffect(() => {
    if (value.preset === "custom") {
      if (value.de && value.ate) {
        const p = resolvePreset("custom", { de: value.de, ate: value.ate });
        setInfo({ de: p.de, ate: p.ate, diasTotais: p.diasTotais });
      }
    } else {
      const p = resolvePreset(value.preset);
      setInfo({ de: p.de, ate: p.ate, diasTotais: p.diasTotais });
    }
  }, [value.preset, value.de, value.ate]);

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border p-3 shadow-sm md:flex-row md:items-center md:justify-between"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:flex-wrap">
        <label className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          Período:
        </label>
        <select
          value={value.preset}
          onChange={(e) =>
            onChange({ ...value, preset: e.target.value as PeriodoPreset })
          }
          className="h-10 w-full rounded-lg border px-3 text-sm font-bold shadow-sm md:w-auto"
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
              className="h-10 min-w-0 rounded-lg border px-3 text-sm font-bold shadow-sm"
              style={{
                background: "var(--bg-input)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            />
            <span className="font-bold" style={{ color: "var(--text-secondary)" }}>→</span>
            <input
              type="date"
              value={customAte}
              onChange={(e) => setCustomAte(e.target.value)}
              onBlur={() => {
                if (customDe && customAte) {
                  onChange({ preset: "custom", de: customDe, ate: customAte });
                }
              }}
              className="h-10 min-w-0 rounded-lg border px-3 text-sm font-bold shadow-sm"
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
        className="flex items-center gap-3 text-xs font-bold tabular"
        style={{ color: "var(--text-secondary)" }}
      >
        {info && (
          <>
            <span>
              {ddmmyyyy(info.de)} → {ddmmyyyy(info.ate)} · {info.diasTotais} dias
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
