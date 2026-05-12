"use client";

import Link from "next/link";

export type Alerta = {
  id: string;
  tipo: "danger" | "warn" | "info";
  titulo: string;
  descricao?: string;
  href?: string;
};

export default function AlertasCriticos({ alertas }: { alertas: Alerta[] }) {
  if (alertas.length === 0) return null;

  return (
    <div className="space-y-2 animate-fade-in">
      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        ⚡ Ação necessária
      </p>
      {alertas.map((a) => {
        const colors = {
          danger: { bg: "var(--danger-bg)", border: "var(--danger)", text: "var(--danger)", icon: "🔴" },
          warn:   { bg: "var(--warn-bg)",   border: "var(--warn)",   text: "var(--warn)",   icon: "⚠️" },
          info:   { bg: "var(--accent-subtle)", border: "var(--accent)", text: "var(--accent)", icon: "ℹ️" },
        }[a.tipo];

        const inner = (
          <div
            className="flex items-start gap-3 rounded-xl px-4 py-3"
            style={{
              background: colors.bg,
              border: `1px solid ${colors.border}`,
            }}
          >
            <span className="text-base mt-0.5 shrink-0">{colors.icon}</span>
            <div className="min-w-0">
              <p className="text-sm font-bold" style={{ color: colors.text }}>{a.titulo}</p>
              {a.descricao && (
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{a.descricao}</p>
              )}
            </div>
            {a.href && (
              <span
                className="ml-auto shrink-0 text-xs font-semibold px-2 py-0.5 rounded-lg"
                style={{ background: colors.border, color: "#fff" }}
              >
                Ver →
              </span>
            )}
          </div>
        );

        return a.href ? (
          <Link key={a.id} href={a.href} className="block">
            {inner}
          </Link>
        ) : (
          <div key={a.id}>{inner}</div>
        );
      })}
    </div>
  );
}
