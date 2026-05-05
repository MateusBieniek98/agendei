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
    <div className="bg-white border border-[var(--color-ink-300)] rounded-2xl p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center gap-3 flex-wrap">
        <label className="text-sm font-bold text-[var(--color-ink-900)]">
          Período:
        </label>
        <select
          value={value.preset}
          onChange={(e) =>
            onChange({ ...value, preset: e.target.value as PeriodoPreset })
          }
          className="h-11 rounded-lg border-2 border-[var(--color-ink-300)] bg-white px-3 text-sm font-semibold text-[var(--color-ink-900)] shadow-sm"
        >
          {Object.entries(PRESETS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>

        {value.preset === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customDe}
              onChange={(e) => setCustomDe(e.target.value)}
              onBlur={() => {
                if (customDe && customAte) {
                  onChange({ preset: "custom", de: customDe, ate: customAte });
                }
              }}
              className="h-11 rounded-lg border-2 border-[var(--color-ink-300)] bg-white px-3 text-sm font-semibold text-[var(--color-ink-900)] shadow-sm"
            />
            <span className="text-[var(--color-ink-500)]">→</span>
            <input
              type="date"
              value={customAte}
              onChange={(e) => setCustomAte(e.target.value)}
              onBlur={() => {
                if (customDe && customAte) {
                  onChange({ preset: "custom", de: customDe, ate: customAte });
                }
              }}
              className="h-11 rounded-lg border-2 border-[var(--color-ink-300)] bg-white px-3 text-sm font-semibold text-[var(--color-ink-900)] shadow-sm"
            />
          </div>
        )}
      </div>

      <div className="text-xs text-[var(--color-ink-500)] tabular flex items-center gap-3">
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
