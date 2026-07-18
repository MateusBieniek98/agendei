"use client";

import NavigationIcon from "@/components/nav/NavigationIcon";
import type { NavigationIconName } from "@/components/nav/navigation";

export type DashboardSection = "indicadores" | "equipes" | "manutencao" | "planejamento";

const SECTIONS: Array<{ key: DashboardSection; label: string; icon: NavigationIconName }> = [
  { key: "indicadores", label: "Indicadores", icon: "chart" },
  { key: "equipes", label: "Equipes", icon: "users" },
  { key: "manutencao", label: "Manutenção", icon: "wrench" },
  { key: "planejamento", label: "Planejamento", icon: "calendar" },
];

export default function DashboardSectionTabs({
  value,
  onChange,
}: {
  value: DashboardSection;
  onChange: (value: DashboardSection) => void;
}) {
  return (
    <nav aria-label="Seções do dashboard" className="overflow-x-auto border-b border-[var(--divider)]">
      <div className="flex min-w-max gap-1">
        {SECTIONS.map((section) => {
          const active = value === section.key;
          return (
            <button
              key={section.key}
              type="button"
              onClick={() => onChange(section.key)}
              aria-current={active ? "page" : undefined}
              className={`relative inline-flex min-h-11 items-center gap-2 px-3 text-sm font-medium transition-colors sm:px-4 ${
                active
                  ? "text-[var(--accent)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <NavigationIcon name={section.icon} />
              {section.label}
              {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--accent)]" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
